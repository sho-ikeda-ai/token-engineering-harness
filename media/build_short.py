#!/usr/bin/env python3
"""Build teh-short-v1.mp4 from media/script.json.

Reads script.json, generates per-segment TTS narration (edge-tts),
renders 1080x1920 PIL slides with baked subtitles, encodes each
segment with ffmpeg, then concatenates into the final short.

ASCII-only source (encoding-guard convention). stdlib + PIL + subprocess only.
"""

import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT_JSON = os.path.join(HERE, "script.json")
OUT_DIR = os.path.join(HERE, "out")

WIDTH = 1080
HEIGHT = 1920

BG_COLOR = (13, 17, 23)  # #0d1117
ACCENT_COLOR = (63, 185, 80)  # #3fb950
WHITE_COLOR = (230, 237, 243)  # #e6edf3
SUBTITLE_BAR_ALPHA = 160

HEADLINE_FONT_PATHS = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
]
SUBTITLE_FONT_PATHS = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
]

HEADLINE_MAX_WIDTH = 940
HEADLINE_FONT_SIZE_MAX = 110
HEADLINE_FONT_SIZE_MIN = 90
SUBTITLE_FONT_SIZE = 48
SUBTITLE_MAX_LINES = 4

ACCENT_FIRST_LINE_SEGMENTS = {1, 2, 6}

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"


def run_checked(cmd, desc):
    """Run a subprocess command (list args, no shell). Raise loudly on failure."""
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result


def load_font(paths, size):
    for path in paths:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    raise RuntimeError("No usable font found in: " + repr(paths))


def wrap_text_to_width(draw, text, font, max_width):
    """Greedy word-wrap a single string to fit max_width, return list of lines."""
    words = text.split()
    if not words:
        return [""]
    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = current + " " + word
        bbox = draw.textbbox((0, 0), candidate, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def gen_tts(text, voice, out_path, fallback_voice):
    cmd = [
        "edge-tts",
        "--voice", voice,
        "--text", text,
        "--write-media", out_path,
    ]
    result = run_checked(cmd, "edge-tts primary voice")
    if result.returncode != 0 or not os.path.isfile(out_path):
        sys.stderr.write(
            "edge-tts failed with voice %s (exit %s): %s\n"
            % (voice, result.returncode, result.stderr.strip())
        )
        sys.stderr.write("Retrying once with fallback voice %s\n" % fallback_voice)
        cmd_fallback = [
            "edge-tts",
            "--voice", fallback_voice,
            "--text", text,
            "--write-media", out_path,
        ]
        result2 = run_checked(cmd_fallback, "edge-tts fallback voice")
        if result2.returncode != 0 or not os.path.isfile(out_path):
            sys.stderr.write(
                "edge-tts failed with fallback voice %s (exit %s): %s\n"
                % (fallback_voice, result2.returncode, result2.stderr.strip())
            )
            sys.exit(1)


def get_duration(media_path):
    cmd = [
        FFPROBE,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        media_path,
    ]
    result = run_checked(cmd, "ffprobe duration")
    if result.returncode != 0:
        sys.stderr.write(
            "ffprobe failed on %s (exit %s): %s\n"
            % (media_path, result.returncode, result.stderr.strip())
        )
        sys.exit(1)
    try:
        return float(result.stdout.strip())
    except ValueError:
        sys.stderr.write("ffprobe returned unparsable duration: %r\n" % result.stdout)
        sys.exit(1)


def render_slide(segment, out_path):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img, "RGBA")

    slide_lines = segment["slide"]
    seg_id = segment["id"]

    # --- Headline block: centered in upper ~55% ---
    headline_area_top = 0
    headline_area_bottom = int(HEIGHT * 0.55)
    headline_area_height = headline_area_bottom - headline_area_top

    font_size = HEADLINE_FONT_SIZE_MAX
    headline_font = load_font(HEADLINE_FONT_PATHS, font_size)

    def build_wrapped(font_size_try):
        font = load_font(HEADLINE_FONT_PATHS, font_size_try)
        all_lines = []
        for raw_line in slide_lines:
            if raw_line == "":
                all_lines.append("")
                continue
            wrapped = wrap_text_to_width(draw, raw_line, font, HEADLINE_MAX_WIDTH)
            all_lines.extend(wrapped)
        return font, all_lines

    # shrink to fit width and to fit vertical area
    chosen_font = None
    chosen_lines = None
    for size_try in range(HEADLINE_FONT_SIZE_MAX, HEADLINE_FONT_SIZE_MIN - 1, -2):
        font, all_lines = build_wrapped(size_try)
        line_height = int(size_try * 1.25)
        total_height = line_height * len(all_lines)
        if total_height <= headline_area_height:
            chosen_font = font
            chosen_lines = all_lines
            font_size = size_try
            break
    if chosen_font is None:
        chosen_font, chosen_lines = build_wrapped(HEADLINE_FONT_SIZE_MIN)
        font_size = HEADLINE_FONT_SIZE_MIN

    line_height = int(font_size * 1.25)
    total_height = line_height * len(chosen_lines)
    start_y = headline_area_top + (headline_area_height - total_height) // 2

    accent_this_slide = seg_id in ACCENT_FIRST_LINE_SEGMENTS
    first_nonempty_seen = False

    y = start_y
    for line in chosen_lines:
        if line != "":
            is_first_content_line = (not first_nonempty_seen) and accent_this_slide
            color = ACCENT_COLOR if is_first_content_line else WHITE_COLOR
            bbox = draw.textbbox((0, 0), line, font=chosen_font)
            w = bbox[2] - bbox[0]
            x = (WIDTH - w) // 2
            draw.text((x, y), line, font=chosen_font, fill=color)
            first_nonempty_seen = True
        y += line_height

    # --- Subtitle block: bottom ~25% ---
    subtitle_area_top = int(HEIGHT * 0.75)
    subtitle_area_height = HEIGHT - subtitle_area_top

    subtitle_font = load_font(SUBTITLE_FONT_PATHS, SUBTITLE_FONT_SIZE)
    narration = segment["narration"]
    sub_max_width = WIDTH - 120  # padding inside bar
    sub_lines = wrap_text_to_width(draw, narration, subtitle_font, sub_max_width)
    if len(sub_lines) > SUBTITLE_MAX_LINES:
        sub_lines = sub_lines[:SUBTITLE_MAX_LINES]

    sub_line_height = int(SUBTITLE_FONT_SIZE * 1.3)
    sub_text_height = sub_line_height * len(sub_lines)
    bar_padding = 40
    bar_height = sub_text_height + bar_padding * 2
    bar_top = subtitle_area_top + (subtitle_area_height - bar_height) // 2
    bar_bottom = bar_top + bar_height

    draw.rectangle(
        [(0, bar_top), (WIDTH, bar_bottom)],
        fill=(0, 0, 0, SUBTITLE_BAR_ALPHA),
    )

    sy = bar_top + bar_padding
    for line in sub_lines:
        bbox = draw.textbbox((0, 0), line, font=subtitle_font)
        w = bbox[2] - bbox[0]
        x = (WIDTH - w) // 2
        draw.text((x, sy), line, font=subtitle_font, fill=WHITE_COLOR)
        sy += sub_line_height

    img.save(out_path)


def encode_segment(slide_path, audio_path, duration, out_path):
    total_duration = duration + 0.35
    cmd = [
        FFMPEG,
        "-y",
        "-loop", "1",
        "-i", slide_path,
        "-i", audio_path,
        "-t", "%.3f" % total_duration,
        "-vf", "scale=%d:%d,fps=30" % (WIDTH, HEIGHT),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        out_path,
    ]
    result = run_checked(cmd, "ffmpeg encode segment")
    if result.returncode != 0 or not os.path.isfile(out_path):
        sys.stderr.write(
            "ffmpeg segment encode failed (exit %s): %s\n"
            % (result.returncode, result.stderr[-2000:])
        )
        sys.exit(1)


def concat_segments(segment_paths, out_path):
    list_path = os.path.join(OUT_DIR, "concat_list.txt")
    with open(list_path, "w", encoding="ascii") as f:
        for p in segment_paths:
            abs_p = os.path.abspath(p).replace("\\", "/")
            f.write("file '%s'\n" % abs_p)

    cmd = [
        FFMPEG,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        out_path,
    ]
    result = run_checked(cmd, "ffmpeg concat")
    if result.returncode != 0 or not os.path.isfile(out_path):
        sys.stderr.write(
            "ffmpeg concat failed (exit %s): %s\n"
            % (result.returncode, result.stderr[-2000:])
        )
        sys.exit(1)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(SCRIPT_JSON, "r", encoding="utf-8") as f:
        script = json.load(f)

    voice = script["voice"]
    fallback_voice = script["fallback_voice"]
    segments = script["segments"]

    durations = []
    segment_video_paths = []

    for seg in segments:
        seg_id = seg["id"]
        mp3_path = os.path.join(OUT_DIR, "seg%d.mp3" % seg_id)
        slide_path = os.path.join(OUT_DIR, "slide%d.png" % seg_id)
        seg_video_path = os.path.join(OUT_DIR, "seg%d.mp4" % seg_id)

        gen_tts(seg["narration"], voice, mp3_path, fallback_voice)
        duration = get_duration(mp3_path)
        durations.append(duration)

        render_slide(seg, slide_path)
        encode_segment(slide_path, mp3_path, duration, seg_video_path)
        segment_video_paths.append(seg_video_path)

    final_path = os.path.join(OUT_DIR, "teh-short-v1.mp4")
    concat_segments(segment_video_paths, final_path)

    print("=== Per-segment audio durations ===")
    for seg, dur in zip(segments, durations):
        print("segment %d: %.2fs" % (seg["id"], dur))

    print("\n=== Final ffprobe summary ===")
    cmd = [
        FFPROBE,
        "-v", "error",
        "-show_entries", "format=duration",
        "-show_entries", "stream=codec_type,width,height",
        "-of", "default=noprint_wrappers=1",
        final_path,
    ]
    result = run_checked(cmd, "final ffprobe summary")
    if result.returncode != 0:
        sys.stderr.write(
            "final ffprobe check failed (exit %s): %s\n"
            % (result.returncode, result.stderr.strip())
        )
        sys.exit(1)
    print(result.stdout)

    print("Done: %s" % final_path)


if __name__ == "__main__":
    main()
