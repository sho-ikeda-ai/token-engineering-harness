#!/usr/bin/env python3
"""Render two publication-ready PNGs from teh impact-data.json.

Usage: python scripts/impact_png.py <dataJsonPath> <outDir>

Writes:
  <outDir>/teh-impact-wide.png   1600x900  (X/GitHub)
  <outDir>/teh-impact-story.png  1080x1920 (Shorts/vertical)

Shares layout language (colors, wording) with the HTML dashboard built by
lib/teh/impact.js. Numbers come straight from the JSON, never synthesized.

ASCII-only source (encoding-guard convention). stdlib + PIL only, no network.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

BG_COLOR = (13, 17, 23)  # #0d1117
TEXT_COLOR = (230, 237, 243)  # #e6edf3
MUTED_COLOR = (139, 148, 158)  # #8b949e
ACCENT_COLOR = (63, 185, 80)  # #3fb950

FAMILY_COLOR = {
    "fable": (63, 185, 80),  # #3fb950
    "opus": (163, 113, 247),  # #a371f7
    "sonnet": (88, 166, 255),  # #58a6ff
    "haiku": (210, 153, 34),  # #d29922
    "other": (139, 148, 158),  # #8b949e
}
FAMILIES = ["fable", "opus", "sonnet", "haiku", "other"]

HEADLINE_FONT_PATHS = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
]
BODY_FONT_PATHS = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
]

FOOTER_TEXT = (
    "real token counts from Claude Code transcripts | "
    "github.com/sho-ikeda-ai/token-engineering-harness"
)
SMALL_N_TAG = "(observation period - early data)"
SMALL_N_THRESHOLD = 5000


def load_font(paths, size):
    for path in paths:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def humanize(n):
    n = float(n)
    a = abs(n)
    if a >= 1e9:
        return "%.1fB" % (n / 1e9)
    if a >= 1e6:
        return "%.1fM" % (n / 1e6)
    if a >= 1e3:
        return "%.1fK" % (n / 1e3)
    return str(int(round(n)))


def pct(n):
    return "%.1f%%" % (n * 100)


def text_w(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def text_h(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[3] - bbox[1]


def compute_before_after(data):
    before = data.get("before") or {}
    after = data.get("after") or {}

    def derive(b):
        out_tokens = b.get("outputTokens", 0) or 0
        msgs = b.get("msgs", 0) or 0
        families = b.get("families") or {}
        fable = families.get("fable", 0) or 0
        fable_share = (fable / out_tokens) if out_tokens > 0 else 0
        out_per_msg = (out_tokens / msgs) if msgs > 0 else 0
        return {
            "outputTokens": out_tokens,
            "msgs": msgs,
            "fableShare": fable_share,
            "outPerMsg": out_per_msg,
        }

    return derive(before), derive(after)


def last_n_days(days_map, n):
    keys = sorted(days_map.keys())
    return keys[-n:]


def draw_stacked_bars(draw, days_map, sorted_days, install_day, x, y, w, h, label_font):
    pad_b = 26
    plot_w = w
    plot_h = h - pad_b
    n = max(1, len(sorted_days))
    gap = 4
    bar_w = max(2.0, (plot_w - gap * (n - 1)) / n) if n > 0 else plot_w

    max_total = 1
    for d in sorted_days:
        total = days_map.get(d, {}).get("outputTokens", 0) or 0
        if total > max_total:
            max_total = total

    for i, d in enumerate(sorted_days):
        bx = x + i * (bar_w + gap)
        day_data = days_map.get(d, {})
        families = day_data.get("families") or {}
        y_cursor = y + plot_h
        for fam in FAMILIES:
            v = (families.get(fam) or {}).get("outputTokens", 0) or 0
            if not v:
                continue
            bh = (v / max_total) * plot_h
            y_cursor -= bh
            draw.rectangle(
                [(bx, y_cursor), (bx + bar_w, y_cursor + bh)],
                fill=FAMILY_COLOR[fam],
            )

    if install_day and install_day in sorted_days:
        idx = sorted_days.index(install_day)
        mx = x + idx * (bar_w + gap)
        draw.line([(mx, y), (mx, y + plot_h)], fill=TEXT_COLOR, width=2)
        draw.text((mx + 4, y), "TEH install", font=label_font, fill=TEXT_COLOR)


def draw_legend(draw, x, y, font, swatch=10, gap=14):
    cx = x
    for fam in FAMILIES:
        draw.rectangle([(cx, y), (cx + swatch, y + swatch)], fill=FAMILY_COLOR[fam])
        cx += swatch + 6
        w = text_w(draw, fam, font)
        draw.text((cx, y - 2), fam, font=font, fill=MUTED_COLOR)
        cx += w + gap


def kpi_block(draw, x, y, w, label, before_val, after_val, after_small_n,
              label_font, val_font, tag_font):
    draw.text((x, y), label, font=label_font, fill=MUTED_COLOR)
    row_y = y + text_h(draw, label, label_font) + 10

    draw.text((x, row_y), "before", font=tag_font, fill=MUTED_COLOR)
    bv_w = text_w(draw, before_val, val_font)
    draw.text((x + w - bv_w, row_y - 3), before_val, font=val_font, fill=TEXT_COLOR)
    row_y += text_h(draw, before_val, val_font) + 10

    after_label = "after"
    draw.text((x, row_y), after_label, font=tag_font, fill=MUTED_COLOR)
    av_w = text_w(draw, after_val, val_font)
    draw.text((x + w - av_w, row_y - 3), after_val, font=val_font, fill=ACCENT_COLOR)
    if after_small_n:
        tag_w = text_w(draw, SMALL_N_TAG, tag_font)
        draw.text((x + w - tag_w, row_y + text_h(draw, after_val, val_font) + 4),
                   SMALL_N_TAG, font=tag_font, fill=MUTED_COLOR)


def render_wide(data, before, after, out_path):
    W, H = 1600, 900
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    headline_font = load_font(HEADLINE_FONT_PATHS, 46)
    sub_font = load_font(BODY_FONT_PATHS, 18)
    kpi_label_font = load_font(BODY_FONT_PATHS, 16)
    kpi_val_font = load_font(HEADLINE_FONT_PATHS, 30)
    kpi_tag_font = load_font(BODY_FONT_PATHS, 14)
    chart_title_font = load_font(BODY_FONT_PATHS, 16)
    legend_font = load_font(BODY_FONT_PATHS, 13)
    footer_font = load_font(BODY_FONT_PATHS, 13)

    margin = 48
    y = margin
    draw.text((margin, y), "Token Engineering Harness - impact", font=headline_font, fill=TEXT_COLOR)
    y += text_h(draw, "Token Engineering Harness - impact", headline_font) + 8
    generated = data.get("generatedAt") or ""
    install_at = data.get("installAt") or ""
    sub = "generated " + generated + (("  |  TEH install " + install_at) if install_at else "")
    draw.text((margin, y), sub, font=sub_font, fill=MUTED_COLOR)
    y += text_h(draw, sub, sub_font) + 28

    after_small_n = after["msgs"] < SMALL_N_THRESHOLD

    kpi_y = y
    kpi_w = (W - margin * 2 - 40) // 2
    kpi_block(draw, margin, kpi_y, kpi_w, "output tokens / msg",
               humanize(before["outPerMsg"]), humanize(after["outPerMsg"]), after_small_n,
               kpi_label_font, kpi_val_font, kpi_tag_font)
    kpi_block(draw, margin + kpi_w + 40, kpi_y, kpi_w, "fable share",
               pct(before["fableShare"]), pct(after["fableShare"]), after_small_n,
               kpi_label_font, kpi_val_font, kpi_tag_font)

    y = kpi_y + 130

    chart_title = "Daily output tokens by model family (last 14 days)"
    draw.text((margin, y), chart_title, font=chart_title_font, fill=TEXT_COLOR)
    y += text_h(draw, chart_title, chart_title_font) + 12

    days_map = data.get("days") or {}
    sorted_days = last_n_days(days_map, 14)
    install_day = install_at[:10] if install_at else None

    chart_x = margin
    chart_y = y
    chart_w = W - margin * 2
    chart_h = 480
    draw_stacked_bars(draw, days_map, sorted_days, install_day, chart_x, chart_y,
                       chart_w, chart_h, legend_font)

    legend_y = chart_y + chart_h + 12
    draw_legend(draw, margin, legend_y, legend_font)

    footer_y = H - margin - text_h(draw, FOOTER_TEXT, footer_font)
    draw.text((margin, footer_y), FOOTER_TEXT, font=footer_font, fill=MUTED_COLOR)

    img.save(out_path)


def render_story(data, before, after, out_path):
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    headline_font = load_font(HEADLINE_FONT_PATHS, 54)
    sub_font = load_font(BODY_FONT_PATHS, 22)
    kpi_label_font = load_font(BODY_FONT_PATHS, 22)
    kpi_val_font = load_font(HEADLINE_FONT_PATHS, 44)
    kpi_tag_font = load_font(BODY_FONT_PATHS, 18)
    chart_title_font = load_font(BODY_FONT_PATHS, 22)
    legend_font = load_font(BODY_FONT_PATHS, 18)
    footer_font = load_font(BODY_FONT_PATHS, 16)

    margin = 56
    y = margin

    headline_lines = ["Token Engineering Harness", "- impact"]
    for line in headline_lines:
        draw.text((margin, y), line, font=headline_font, fill=TEXT_COLOR)
        y += text_h(draw, line, headline_font) + 6
    y += 8

    generated = data.get("generatedAt") or ""
    install_at = data.get("installAt") or ""
    sub = "generated " + generated
    draw.text((margin, y), sub, font=sub_font, fill=MUTED_COLOR)
    y += text_h(draw, sub, sub_font) + 4
    if install_at:
        sub2 = "TEH install " + install_at
        draw.text((margin, y), sub2, font=sub_font, fill=MUTED_COLOR)
        y += text_h(draw, sub2, sub_font)
    y += 48

    after_small_n = after["msgs"] < SMALL_N_THRESHOLD

    kpi_w = W - margin * 2
    kpi_block(draw, margin, y, kpi_w, "output tokens / msg",
               humanize(before["outPerMsg"]), humanize(after["outPerMsg"]), after_small_n,
               kpi_label_font, kpi_val_font, kpi_tag_font)
    y += 160

    kpi_block(draw, margin, y, kpi_w, "fable share",
               pct(before["fableShare"]), pct(after["fableShare"]), after_small_n,
               kpi_label_font, kpi_val_font, kpi_tag_font)
    y += 190

    chart_title = "Daily output tokens by model family (last 14 days)"
    draw.text((margin, y), chart_title, font=chart_title_font, fill=TEXT_COLOR)
    y += text_h(draw, chart_title, chart_title_font) + 16

    days_map = data.get("days") or {}
    sorted_days = last_n_days(days_map, 14)
    install_day = install_at[:10] if install_at else None

    chart_x = margin
    chart_y = y
    chart_w = W - margin * 2
    chart_h = 900
    draw_stacked_bars(draw, days_map, sorted_days, install_day, chart_x, chart_y,
                       chart_w, chart_h, legend_font)

    legend_y = chart_y + chart_h + 20
    draw_legend(draw, margin, legend_y, legend_font, swatch=14, gap=18)

    footer_lines_area_y = H - margin - text_h(draw, FOOTER_TEXT, footer_font) * 2 - 8
    words = FOOTER_TEXT.split(" | ")
    fy = footer_lines_area_y
    for line in words:
        draw.text((margin, fy), line, font=footer_font, fill=MUTED_COLOR)
        fy += text_h(draw, line, footer_font) + 8

    img.save(out_path)


def main():
    if len(sys.argv) < 3:
        sys.stderr.write("usage: python impact_png.py <dataJsonPath> <outDir>\n")
        sys.exit(1)

    data_path = sys.argv[1]
    out_dir = sys.argv[2]

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    before, after = compute_before_after(data)

    os.makedirs(out_dir, exist_ok=True)
    wide_path = os.path.join(out_dir, "teh-impact-wide.png")
    story_path = os.path.join(out_dir, "teh-impact-story.png")

    render_wide(data, before, after, wide_path)
    render_story(data, before, after, story_path)

    print("wrote " + wide_path)
    print("wrote " + story_path)


if __name__ == "__main__":
    main()
