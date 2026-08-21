import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle, FancyArrowPatch
from matplotlib.lines import Line2D

# Resolved relative to this script's own location, not the caller's cwd.
DIAGRAMS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagrams")

INK = "#1b241f"
ACCENT = "#33508c"
FONT = "DejaVu Sans"


def new_fig(w, h):
    fig, ax = plt.subplots(figsize=(w, h), dpi=200)
    ax.set_xlim(0, w * 10)
    ax.set_ylim(0, h * 10)
    ax.axis("off")
    return fig, ax


def stick_actor(ax, x, y, label):
    head_r = 3.2
    ax.add_patch(plt.Circle((x, y + 15), head_r, fill=False, edgecolor=INK, linewidth=1.4))
    ax.plot([x, x], [y + 11.8, y], color=INK, linewidth=1.4)
    ax.plot([x - 6, x + 6], [y + 8, y + 8], color=INK, linewidth=1.4)
    ax.plot([x, x - 5], [y, y - 8], color=INK, linewidth=1.4)
    ax.plot([x, x + 5], [y, y - 8], color=INK, linewidth=1.4)
    ax.text(x, y - 12, label, ha="center", va="top", fontsize=9, fontfamily=FONT, color=INK)


def usecase_oval(ax, x, y, w, h, label):
    e = Ellipse((x, y), w, h, fill=True, facecolor="white", edgecolor=ACCENT, linewidth=1.3, zorder=2)
    ax.add_patch(e)
    ax.text(x, y, label, ha="center", va="center", fontsize=8.3, fontfamily=FONT, color=INK, zorder=3, wrap=True)


def arrow(ax, p1, p2, style="-", color=INK, label=None, curve=0.0, lw=1.1):
    a = FancyArrowPatch(p1, p2, arrowstyle="-|>" if style != "assoc" else "-",
                         mutation_scale=10, color=color, linewidth=lw,
                         connectionstyle=f"arc3,rad={curve}", linestyle="--" if style == "include" else "-")
    ax.add_patch(a)
    if label:
        mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        ax.text(mx, my + 2.5, label, ha="center", fontsize=7, fontfamily=FONT, color=color, style="italic")


# ============================================================
# FIGURE 4.2a -- USE CASE DIAGRAM
# ============================================================
fig, ax = new_fig(11, 7.5)

# system boundary
boundary = FancyBboxPatch((22, 4), 62, 62, boxstyle="round,pad=0,rounding_size=1",
                           fill=False, edgecolor=INK, linewidth=1.4)
ax.add_patch(boundary)
ax.text(53, 68, "Real-Time Fraud Detection Smart Glasses — Cloud Verification Engine",
        ha="center", fontsize=9.5, fontfamily=FONT, color=INK, fontweight="bold")

# actors
stick_actor(ax, 8, 40, "Verification\nOfficer")
stick_actor(ax, 98, 40, "Subject")

# use cases
uc = {
    "capture_voice": (32, 58, "Capture Voice\nSample"),
    "capture_face": (32, 46, "Capture Live\nFace"),
    "capture_doc": (32, 34, "Capture ID\nDocument"),
    "check_voice": (52, 58, "Check Voice\nLiveness"),
    "check_face": (52, 46, "Check Facial\nLiveness"),
    "check_doc": (52, 34, "Check Document\nAuthenticity"),
    "match_id": (52, 22, "Match Face\nto ID"),
    "fuse": (72, 40, "Fuse Multi-Modal\nRisk Score"),
    "view": (72, 14, "View Fraud\nVerdict"),
}
for key, (x, y, label) in uc.items():
    usecase_oval(ax, x, y, 17, 9, label)

# officer associations
arrow(ax, (12, 45), (24, 58), style="assoc")
arrow(ax, (12, 40), (24, 46), style="assoc")
arrow(ax, (12, 20), (66, 15), style="assoc", curve=-0.15)
# subject associations
arrow(ax, (94, 45), (60, 58), style="assoc", curve=0.1)
arrow(ax, (94, 42), (60, 46), style="assoc")
arrow(ax, (94, 30), (60, 34), style="assoc", curve=-0.1)

# capture -> check (fresh-analysis: each check consumes that interaction's capture only)
arrow(ax, (40.5, 58), (43.5, 58), color=ACCENT)
arrow(ax, (40.5, 46), (43.5, 46), color=ACCENT)
arrow(ax, (40.5, 34), (43.5, 34), color=ACCENT)
arrow(ax, (40.5, 34), (44, 24), color=ACCENT, curve=0.15)

# <<include>> from Fuse
for key in ["check_voice", "check_face", "check_doc", "match_id"]:
    x, y, _ = uc[key]
    arrow(ax, (67, 38), (x + 8, y), style="include", color=ACCENT, curve=-0.08)
ax.text(67, 44, "«include»", fontsize=6.5, fontfamily=FONT, color=ACCENT, style="italic")

arrow(ax, (72, 35.5), (72, 18.5), color=INK)

ax.set_xlim(0, 106)
ax.set_ylim(2, 72)
plt.tight_layout()
plt.savefig(os.path.join(DIAGRAMS_DIR, "uc_diagram.png"), bbox_inches="tight", facecolor="white")
plt.close()

# ============================================================
# FIGURE 4.2b -- SEQUENCE DIAGRAM (verified voice-check flow)
# ============================================================
fig, ax = plt.subplots(figsize=(11.5, 7), dpi=200)
ax.axis("off")
lanes = ["Wearer", "ESP32-S3\nFirmware", "Cloud:\n/voice-check", "Cloud:\n/risk-score", "Onboard\nLED"]
xs = [8, 28, 52, 76, 96]
top = 62
bottom = 4

for x, label in zip(xs, lanes):
    ax.add_patch(FancyBboxPatch((x - 8, top), 16, 6, boxstyle="round,pad=0.3", facecolor="#eef0ec",
                                 edgecolor=INK, linewidth=1.2))
    ax.text(x, top + 3, label, ha="center", va="center", fontsize=8, fontfamily=FONT, color=INK)
    ax.plot([x, x], [top, bottom], color=INK, linewidth=0.8, linestyle=(0, (4, 3)))

messages = [
    (1, "self", "record 5s audio\ninto PSRAM buffer"),
    (2, "1->2", "POST WAV (multipart)"),
    (3, "2->1", "200 OK: voice_liveness_score,\nspoof_type"),
    (4, "1->3", "POST voice_liveness_score"),
    (5, "3->1", "200 OK: risk_level,\nrecommendation"),
    (6, "1->4", "display verdict\n(LED pattern)"),
    (7, "1->0", "discreet result\n(bone-conduction stand-in)"),
]

y = top - 5
step = 7.3
for i, (num, kind, text) in enumerate(messages):
    y -= step
    if kind == "self":
        x = xs[1]
        ax.add_patch(FancyArrowPatch((x, y + 2.3), (x, y - 2.3), connectionstyle="arc3,rad=-1.3",
                                      arrowstyle="-|>", mutation_scale=9, color=ACCENT, linewidth=1.1))
        ax.text(x + 9, y, f"{num}. {text}", ha="left", va="center", fontsize=7, fontfamily=FONT, color=INK)
    else:
        src, dst = kind.split("->")
        x1, x2 = xs[int(src)], xs[int(dst)]
        style = "-|>" if int(dst) != 0 else "-|>"
        col = INK if not text.startswith("discreet") else "#888"
        ax.add_patch(FancyArrowPatch((x1, y), (x2, y), arrowstyle="-|>", mutation_scale=9,
                                      color=col, linewidth=1.1,
                                      linestyle="--" if "200 OK" in text or "discreet" in text else "-"))
        mx = (x1 + x2) / 2
        ax.text(mx, y + 1.6, f"{num}. {text}", ha="center", va="bottom", fontsize=7, fontfamily=FONT, color=INK)

ax.set_xlim(0, 104)
ax.set_ylim(bottom - 2, top + 8)
plt.tight_layout()
plt.savefig(os.path.join(DIAGRAMS_DIR, "seq_diagram.png"), bbox_inches="tight", facecolor="white")
plt.close()

# ============================================================
# FIGURE 4.2c -- STATE CHART (device lifecycle, matches setup()/loop())
# ============================================================
fig, ax = new_fig(10, 6.5)

states = {
    "boot": (10, 55, "Boot /\nInitializing"),
    "wifi": (32, 55, "Connecting\nWi-Fi"),
    "sensors": (54, 55, "Initializing\nMicrophone"),
    "capture": (54, 32, "Capturing\nAudio (5s)"),
    "upload": (32, 32, "Uploading to\nCloud"),
    "verdict": (10, 32, "Displaying\nVerdict (LED)"),
    "error": (76, 55, "Error\n(halt, blink)"),
}
for key, (x, y, label) in states.items():
    box = FancyBboxPatch((x - 10, y - 6), 20, 12, boxstyle="round,pad=0.6,rounding_size=2",
                          facecolor="white", edgecolor=ACCENT if key != "error" else "#ae3b34", linewidth=1.4)
    ax.add_patch(box)
    ax.text(x, y, label, ha="center", va="center", fontsize=8, fontfamily=FONT, color=INK)

# initial pseudostate
ax.add_patch(plt.Circle((10, 66), 1.3, facecolor=INK))
arrow(ax, (10, 64.5), (10, 61))

arrow(ax, (20, 55), (22, 55), label="Wi-Fi ready")
arrow(ax, (42, 55), (44, 55), label="mic ready")
arrow(ax, (54, 49), (54, 38), label="init complete")
arrow(ax, (44, 32), (42, 32), label="5s elapsed")
arrow(ax, (22, 32), (20, 32), label="HTTP 200")
# loop back
arrow(ax, (10, 26), (10, 20), curve=0)
ax.plot([10, 54], [20, 20], color=INK, linewidth=1.1)
arrow(ax, (54, 20), (54, 26), curve=0)
ax.text(32, 17.5, "10s interval elapsed → next detection cycle", ha="center", fontsize=7,
        fontfamily=FONT, color=INK, style="italic")

# error transitions
arrow(ax, (64, 55), (66, 55), label="timeout / init fail", color="#ae3b34")

ax.set_xlim(0, 90)
ax.set_ylim(10, 70)
plt.tight_layout()
plt.savefig(os.path.join(DIAGRAMS_DIR, "state_diagram.png"), bbox_inches="tight", facecolor="white")
plt.close()

print("all three diagrams written")
