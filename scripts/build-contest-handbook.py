#!/usr/bin/env python3
"""Build a print-friendly ICPC handbook from the site's Markdown archive."""

from __future__ import annotations

import html
import re
import shutil
from datetime import date
from pathlib import Path

import yaml
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
TOPICS_DIR = ROOT / "src/content/problem-tags"
PROBLEMS_DIR = ROOT / "src/content/problems"
SOLUTIONS_DIR = ROOT / "solutions"
OUTPUT = ROOT / "output/pdf/icpc-contest-handbook.pdf"
PUBLIC_OUTPUT = ROOT / "public/downloads/icpc-contest-handbook.pdf"

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#20231F")
MUTED = colors.HexColor("#6F756E")
GREEN = colors.HexColor("#526A58")
LIGHT_GREEN = colors.HexColor("#E8EEE9")
PAPER = colors.HexColor("#F7F7F3")
LINE = colors.HexColor("#D8DBD4")
CODE_BG = colors.HexColor("#F0F2EE")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("CN", "/home/lbh/.fonts/SimHei.ttf"))
    pdfmetrics.registerFont(
        TTFont("CNMono", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", subfontIndex=2)
    )


register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="BodyCN", fontName="CN", fontSize=9.4, leading=16,
    textColor=INK, wordWrap="CJK", spaceAfter=3 * mm,
))
styles.add(ParagraphStyle(
    name="LeadCN", parent=styles["BodyCN"], fontSize=11, leading=18,
    textColor=colors.HexColor("#485048"), spaceAfter=5 * mm,
))
styles.add(ParagraphStyle(
    name="Heading1CN", fontName="CN", fontSize=23, leading=30,
    textColor=INK, wordWrap="CJK", spaceBefore=4 * mm, spaceAfter=6 * mm,
))
styles.add(ParagraphStyle(
    name="Heading2CN", fontName="CN", fontSize=15, leading=21,
    textColor=GREEN, wordWrap="CJK", spaceBefore=5 * mm, spaceAfter=3 * mm,
))
styles.add(ParagraphStyle(
    name="Heading3CN", fontName="CN", fontSize=11.5, leading=17,
    textColor=INK, wordWrap="CJK", spaceBefore=3 * mm, spaceAfter=2 * mm,
))
styles.add(ParagraphStyle(
    name="MetaCN", fontName="CN", fontSize=7.6, leading=12,
    textColor=MUTED, wordWrap="CJK", spaceAfter=3 * mm,
))
styles.add(ParagraphStyle(
    name="BulletCN", parent=styles["BodyCN"], leftIndent=5 * mm,
    firstLineIndent=-3.4 * mm, bulletIndent=0, spaceAfter=1.3 * mm,
))
styles.add(ParagraphStyle(
    name="EquationCN", fontName="CNMono", fontSize=9.2, leading=15,
    alignment=TA_CENTER, textColor=INK, backColor=LIGHT_GREEN,
    borderPadding=(3 * mm, 4 * mm, 3 * mm, 4 * mm), spaceAfter=4 * mm,
))
styles.add(ParagraphStyle(
    name="CodeCN", fontName="CNMono", fontSize=6.35, leading=9.2,
    textColor=colors.HexColor("#26322A"), backColor=CODE_BG,
    borderColor=LINE, borderWidth=0.5, borderPadding=3 * mm,
    leftIndent=0, rightIndent=0, spaceBefore=2 * mm, spaceAfter=4 * mm,
))
styles.add(ParagraphStyle(
    name="TOC1CN", fontName="CN", fontSize=11, leading=20,
    leftIndent=0, firstLineIndent=0, textColor=INK,
))
styles.add(ParagraphStyle(
    name="TOC2CN", fontName="CN", fontSize=8.5, leading=15,
    leftIndent=7 * mm, firstLineIndent=0, textColor=MUTED,
))


def read_markdown(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, re.S)
    if not match:
        return {}, raw
    return yaml.safe_load(match.group(1)) or {}, match.group(2).strip()


def latex_to_text(value: str) -> str:
    def render_sum(match: re.Match[str]) -> str:
        scope = match.group(1).replace(r"\ne", "≠").replace(" ", "")
        return f"∑({scope})"

    value = re.sub(r"\\sum_\{([^}]+)\}", render_sum, value)
    value = re.sub(r"\\sum_([A-Za-z0-9])", render_sum, value)
    value = re.sub(r"_\{([^}]+)\}", r"_(\1)", value)
    value = re.sub(r"\^\{([^}]+)\}", r"^(\1)", value)
    replacements = {
        r"\textstyle": "", r"\le": "≤", r"\ge": "≥", r"\ne": "≠",
        r"\ldots": "…", r"\sum": "∑", r"\mid": "|", r"\ll": "<<",
        r"\to": "→", r"\frac": "frac", r"\left": "", r"\right": "",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\\begin\{[^}]+\}|\\end\{[^}]+\}", "", value)
    value = value.replace("\\", " ").replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", value).strip()


def inline_markup(value: str) -> str:
    value = latex_to_text(value.strip())
    parts = re.split(r"(`[^`]+`)", value)
    rendered = []
    for part in parts:
        if part.startswith("`") and part.endswith("`"):
            rendered.append(
                f'<font name="CNMono" color="#36513D">{html.escape(part[1:-1])}</font>'
            )
        else:
            part = html.escape(part)
            part = re.sub(r"_\(([^)]+)\)", r"<sub>\1</sub>", part)
            part = re.sub(r"_([A-Za-z0-9])", r"<sub>\1</sub>", part)
            part = re.sub(r"\^\(([^)]+)\)", r"<super>\1</super>", part)
            part = re.sub(r"\^([A-Za-z0-9])", r"<super>\1</super>", part)
            part = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", part)
            rendered.append(part.replace("$", ""))
    return "".join(rendered)


def markdown_flowables(body: str) -> list[Flowable]:
    result: list[Flowable] = []
    paragraph: list[str] = []
    code: list[str] = []
    equation: list[str] = []
    in_code = False
    in_equation = False

    def flush_paragraph() -> None:
        if paragraph:
            result.append(Paragraph(inline_markup(" ".join(paragraph)), styles["BodyCN"]))
            paragraph.clear()

    for raw_line in body.splitlines() + [""]:
        line = raw_line.rstrip()
        if line.startswith("```"):
            if in_code:
                result.append(XPreformatted(html.escape("\n".join(code)), styles["CodeCN"]
                ))
                code.clear()
                in_code = False
            else:
                flush_paragraph()
                in_code = True
            continue
        if in_code:
            code.append(line.expandtabs(4))
            continue
        if line.strip() == "$$":
            if in_equation:
                result.append(Paragraph(inline_markup(" ".join(equation)), styles["EquationCN"]))
                equation.clear()
                in_equation = False
            else:
                flush_paragraph()
                in_equation = True
            continue
        if in_equation:
            equation.append(line)
            continue
        heading = re.match(r"^(#{2,3})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            style = styles["Heading2CN"] if len(heading.group(1)) == 2 else styles["Heading3CN"]
            result.append(Paragraph(inline_markup(heading.group(2)), style))
            continue
        bullet = re.match(r"^[-*]\s+(.+)$", line)
        ordered = re.match(r"^(\d+)\.\s+(.+)$", line)
        if bullet or ordered:
            flush_paragraph()
            mark = "•" if bullet else f"{ordered.group(1)}."
            text = bullet.group(1) if bullet else ordered.group(2)
            result.append(Paragraph(f"{mark}　{inline_markup(text)}", styles["BulletCN"]))
            continue
        if not line.strip():
            flush_paragraph()
        else:
            paragraph.append(line.strip())
    return result


class HandbookDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename, pagesize=A4,
            leftMargin=18 * mm, rightMargin=18 * mm,
            topMargin=19 * mm, bottomMargin=17 * mm,
            title="LBH ICPC 赛前速查册", author="LBH",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates(PageTemplate(id="normal", frames=frame, onPage=self.draw_page))

    def draw_page(self, canvas, doc) -> None:
        canvas.saveState()
        canvas.setFillColor(PAPER)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        if doc.page > 1:
            canvas.setStrokeColor(LINE)
            canvas.line(18 * mm, PAGE_H - 13 * mm, PAGE_W - 18 * mm, PAGE_H - 13 * mm)
            canvas.setFont("CNMono", 7)
            canvas.setFillColor(MUTED)
            canvas.drawString(18 * mm, PAGE_H - 10 * mm, "LBH / ICPC CONTEST HANDBOOK")
            canvas.drawRightString(PAGE_W - 18 * mm, 10 * mm, f"{doc.page:02d}")
        canvas.restoreState()

    def afterFlowable(self, flowable: Flowable) -> None:
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style in {"Heading1CN", "Heading2CN"}:
                level = 0 if style == "Heading1CN" else 1
                text = flowable.getPlainText()
                key = f"section-{self.seq.nextf('section')}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)
                self.notify("TOCEntry", (level, text, self.page, key))


def section_title(label: str, title: str, count: str = "") -> list[Flowable]:
    meta = label if not count else f"{label}  /  {count}"
    return [
        Paragraph(meta, styles["MetaCN"]),
        Paragraph(title, styles["Heading1CN"]),
    ]


def build_story() -> list[Flowable]:
    topic_entries = []
    for path in TOPICS_DIR.glob("*.md"):
        data, body = read_markdown(path)
        if not data.get("draft", False):
            topic_entries.append((data.get("order", 0), path, data, body))
    topic_entries.sort(key=lambda item: (item[0], item[2].get("title", "")))

    problem_entries = []
    for path in PROBLEMS_DIR.glob("*.md"):
        data, body = read_markdown(path)
        if not data.get("draft", False):
            problem_entries.append((str(data.get("solvedAt", "")), path, data, body))
    problem_entries.sort(key=lambda item: (item[0], item[1].name), reverse=True)

    story: list[Flowable] = [
        Spacer(1, 29 * mm),
        Paragraph("ICPC / CONTEST NOTES", styles["MetaCN"]),
        Paragraph("赛前速查册", ParagraphStyle(
            "CoverTitle", parent=styles["Heading1CN"], fontSize=36, leading=44,
            textColor=INK, spaceAfter=6 * mm,
        )),
        Paragraph("题目归档与标签板子", ParagraphStyle(
            "CoverSub", parent=styles["LeadCN"], fontSize=16, leading=24,
            textColor=GREEN,
        )),
        Spacer(1, 52 * mm),
        Table([
            ["题目", f"{len(problem_entries):02d}"],
            ["标签板子", f"{len(topic_entries):02d}"],
            ["生成日期", date.today().isoformat()],
        ], colWidths=[38 * mm, 74 * mm], style=TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "CN"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
            ("TEXTCOLOR", (1, 0), (1, -1), INK),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
        ])),
        Spacer(1, 12 * mm),
        Paragraph(
            "板子部分按标签顺序排在前面，做题记录按完成时间倒序排在后面。内容来自个人网站，保留原有思路与表述。",
            styles["LeadCN"],
        ),
        PageBreak(),
        *section_title("CONTENTS", "目录"),
    ]

    toc = TableOfContents()
    toc.levelStyles = [styles["TOC1CN"], styles["TOC2CN"]]
    toc.dotsMinLevel = 0
    story.extend([toc, PageBreak()])

    story.extend(section_title("PART 01", "标签板子", f"{len(topic_entries)} 篇"))
    story.append(Paragraph(
        "从识别标签进入对应知识点；公式、变量和代码已统一为适合屏幕阅读与打印的格式。",
        styles["LeadCN"],
    ))
    for index, (_, path, data, body) in enumerate(topic_entries, 1):
        story.extend([
            Paragraph(f"{index:02d}  /  {path.stem}", styles["MetaCN"]),
            Paragraph(str(data.get("title", path.stem)), styles["Heading2CN"]),
            Paragraph(inline_markup(str(data.get("summary", ""))), styles["LeadCN"]),
            *markdown_flowables(body),
            Spacer(1, 5 * mm),
        ])

    story.extend([PageBreak(), *section_title("PART 02", "做题记录", f"{len(problem_entries)} 题")])
    story.append(Paragraph(
        "每题保留题目大意、原始解题思路和提交代码，便于比赛前按标签回忆完整路径。",
        styles["LeadCN"],
    ))
    for index, (_, path, data, body) in enumerate(problem_entries, 1):
        title = str(data.get("title", path.stem))
        tags = " / ".join(str(tag) for tag in data.get("tags", []))
        story.extend([
            HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=7 * mm, spaceAfter=7 * mm)
            if index > 1 else Spacer(1, 2 * mm),
            Paragraph(f"{index:02d}  /  {path.stem}", styles["MetaCN"]),
            Paragraph(title, styles["Heading2CN"]),
            Paragraph(
                inline_markup(
                    f"{data.get('platform', '')}　{data.get('solvedAt', '')}　{tags}　代码：{data.get('code', '')}"
                ),
                styles["MetaCN"],
            ),
            Paragraph("题目大意", styles["Heading3CN"]),
            *markdown_flowables(str(data.get("statement", ""))),
            Paragraph("思路", styles["Heading3CN"]),
            *markdown_flowables(body),
            Paragraph("提交代码", styles["Heading3CN"]),
        ])
        code_path = SOLUTIONS_DIR / str(data.get("code", ""))
        if code_path.exists():
            story.append(XPreformatted(
                html.escape(code_path.read_text(encoding="utf-8").rstrip()), styles["CodeCN"]
            ))
        else:
            story.append(Paragraph("未找到对应代码文件。", styles["BodyCN"]))

    story.extend([
        PageBreak(),
        *section_title("END", "上场前最后检查"),
        Paragraph("□ 先读完所有题，按预期难度与队友分工。", styles["BodyCN"]),
        Paragraph("□ 写清状态、转移、复杂度和边界，再开始敲代码。", styles["BodyCN"]),
        Paragraph("□ 检查 long long、数组范围、初始化、多测清空与下标。", styles["BodyCN"]),
        Paragraph("□ 图论检查非连通图、重边、自环与父边；位运算检查移位宽度。", styles["BodyCN"]),
        Paragraph("□ 提交前跑样例、自造极小数据，并复查输出格式。", styles["BodyCN"]),
        Spacer(1, 24 * mm),
        Paragraph("GL & HF.", ParagraphStyle(
            "EndMark", parent=styles["Heading1CN"], alignment=TA_CENTER,
            fontName="CNMono", fontSize=28, textColor=GREEN,
        )),
    ])
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = HandbookDoc(str(OUTPUT))
    doc.multiBuild(build_story())
    shutil.copy2(OUTPUT, PUBLIC_OUTPUT)
    print(f"built {OUTPUT.relative_to(ROOT)}")
    print(f"copied {PUBLIC_OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
