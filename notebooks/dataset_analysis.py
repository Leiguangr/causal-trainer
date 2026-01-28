#!/usr/bin/env python3
"""Generate analysis images for the causal reasoning dataset report.

This script (re)generates the PNGs referenced by notebooks/report.tex:
  - images/basic_stats.png
  - images/similarity_analysis.png
  - images/tsne_visualization.png
	  - images/subdomain_ground_truth.png
  - images/scenario_length.png
  - images/inter_annotator.png
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


def _load_questions(data_dir: Path) -> tuple[list[dict], dict[str, list[dict]]]:
    """Returns (all_questions, questions_by_annotator_name)."""

    author_map = {
        "deveen": "Deveen",
        "theodore-wu": "Theodore",
        "tony": "Tony",
        "juli": "Juli",
    }

    # Map email to display name for combined file
    email_to_name = {
        "deveen@stanford.edu": "Deveen",
        "wutheodo@stanford.edu": "Theodore",
        "lgren007@stanford.edu": "Tony",
        "julih@stanford.edu": "Juli",
    }

    all_questions: list[dict] = []
    by_author: dict[str, list[dict]] = defaultdict(list)

    for f in sorted(data_dir.glob("*.json")):
        # Skip combined files to avoid duplicates when individual files exist
        if "combined" in f.name.lower():
            continue

        with open(f) as file:
            data = json.load(file)

        questions = data if isinstance(data, list) else data.get("questions", [])
        all_questions.extend(questions)

        matched = False
        for name_key, name_val in author_map.items():
            if name_key in f.name.lower():
                by_author[name_val].extend(questions)
                matched = True
                break
        if not matched:
            by_author[f.name].extend(questions)

    # If no questions loaded (only combined file exists), load from combined
    if not all_questions:
        combined_files = list(data_dir.glob("combined*.json"))
        if combined_files:
            with open(combined_files[0]) as file:
                data = json.load(file)
            questions = data.get("questions", [])
            all_questions.extend(questions)
            # Group by author field in combined file
            for q in questions:
                author_email = q.get("author", "Unknown")
                author_name = email_to_name.get(author_email, author_email)
                by_author[author_name].append(q)

    return all_questions, dict(by_author)


def _get(q: dict, *path: str, default=None):
    cur = q
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def _word_count(text: str) -> int:
    return len((text or "").split())


def _save(fig, out_path: Path):
    # Prefer preserving the figure's intended aspect ratio; constrained_layout
    # is used on figures where needed to avoid overlap/clipping.
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"Saved {out_path}")


def _norm_str(x) -> str:
    if x is None:
        return ""
    return str(x).strip()


def _norm_difficulty(x) -> str:
    s = _norm_str(x).lower()
    if s in {"easy", "e"}:
        return "EASY"
    if s in {"medium", "med", "m"}:
        return "MEDIUM"
    if s in {"hard", "h"}:
        return "HARD"
    return "UNKNOWN"


def _norm_subdomain(x) -> str:
    s = _norm_str(x)
    if not s:
        return "UNKNOWN"
    # Canonicalize trivial casing / whitespace differences.
    return " ".join(s.split()).title()


def _compute_embeddings(scenarios: list[str]) -> np.ndarray:
    """Compute sentence embeddings using all-MiniLM-L6-v2."""

    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    emb = model.encode(scenarios, show_progress_bar=True, normalize_embeddings=True)
    return np.asarray(emb, dtype=np.float32)


def main() -> None:
    np.random.seed(42)

    data_dir = Path("../data")
    img_dir = Path("images")
    img_dir.mkdir(exist_ok=True)

    all_questions, by_author = _load_questions(data_dir)
    print(f"Loaded {len(all_questions)} questions from {data_dir}")

    # ------------------------------------------------------------------
    # basic_stats.png (2x3 grid)
    # ------------------------------------------------------------------
    # Use constrained_layout to prevent subplot titles/labels from overlapping.
    fig, axes = plt.subplots(2, 3, figsize=(14, 8), constrained_layout=True)

    # Ground truth
    gt_counts = Counter(q.get("groundTruth") for q in all_questions)
    ax = axes[0, 0]
    gt_labels = ["NO", "YES", "AMBIGUOUS"]
    gt_values = [gt_counts.get(l, 0) for l in gt_labels]
    ax.bar(gt_labels, gt_values, color=["#e74c3c", "#27ae60", "#f39c12"])
    ax.set_title("Ground Truth")
    ax.set_ylabel("Count")
    for i, v in enumerate(gt_values):
        ax.text(i, v + max(1, 0.01 * max(gt_values)), str(v), ha="center", fontsize=9)

    # Pearl level
    pl_counts = Counter(_get(q, "annotations", "pearlLevel", default="UNKNOWN") for q in all_questions)
    ax = axes[0, 1]
    pl_labels = ["L1", "L2", "L3"]
    pl_values = [pl_counts.get(l, 0) for l in pl_labels]
    ax.bar(pl_labels, pl_values, color=["#3498db", "#9b59b6", "#1abc9c"])
    ax.set_title("Pearl Level")
    ax.set_ylabel("Count")
    for i, v in enumerate(pl_values):
        ax.text(i, v + max(1, 0.01 * max(pl_values)), str(v), ha="center", fontsize=9)

    # Trap types (NO only, since YES/AMBIGUOUS should have NONE)
    no_cases = [q for q in all_questions if q.get("groundTruth") == "NO"]
    trap_counts = Counter(_get(q, "annotations", "trapType", default="UNKNOWN") for q in no_cases)
    ax = axes[0, 2]
    top_traps = trap_counts.most_common(10)
    # Keep labels short and use a smaller font to avoid collisions.
    labels = [t[0].replace("_", "-")[:18] for t in top_traps]
    values = [t[1] for t in top_traps]
    ax.barh(labels[::-1], values[::-1], color="#e67e22")
    ax.set_title("Trap Type (NO only)")
    ax.set_xlabel("Count")
    ax.tick_params(axis="y", labelsize=8)

    # Difficulty
    diff_counts = Counter(_norm_difficulty(_get(q, "annotations", "difficulty")) for q in all_questions)
    ax = axes[1, 0]
    diff_labels = ["EASY", "MEDIUM", "HARD"]
    diff_values = [diff_counts.get(l, 0) for l in diff_labels]
    ax.bar(diff_labels, diff_values, color=["#2ecc71", "#f1c40f", "#e74c3c"])
    ax.set_title("Difficulty")
    ax.set_ylabel("Count")
    for i, v in enumerate(diff_values):
        ax.text(i, v + max(1, 0.01 * max(diff_values)), str(v), ha="center", fontsize=9)

    # Subdomain (more informative than domain since domain is constant = Markets)
    subdomain_counts = Counter(_norm_subdomain(_get(q, "annotations", "subdomain")) for q in all_questions)
    ax = axes[1, 1]
    top_subdomains = subdomain_counts.most_common(8)
    labels = [d[0] for d in top_subdomains]
    values = [d[1] for d in top_subdomains]
    ax.bar(labels, values, color="#9b59b6")
    ax.set_title("Subdomain (top 8)")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=30)
    for tick in ax.get_xticklabels():
        tick.set_ha("right")

    # Questions by annotator
    ax = axes[1, 2]
    author_counts = {k: len(v) for k, v in sorted(by_author.items())}
    ax.bar(author_counts.keys(), author_counts.values(), color="#3498db")
    ax.set_title("Questions by Annotator")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=15)
    for i, (k, v) in enumerate(author_counts.items()):
        ax.text(i, v + max(1, 0.01 * max(author_counts.values())), str(v), ha="center", fontsize=9)

    # Slightly increase spacing between subplots (constrained_layout is on).
    fig.set_constrained_layout_pads(w_pad=0.06, h_pad=0.06, wspace=0.04, hspace=0.04)
    _save(fig, img_dir / "basic_stats.png")

    # ------------------------------------------------------------------
    # scenario_length.png (word count by GT and difficulty)
    # ------------------------------------------------------------------
    word_counts = np.array([_word_count(q.get("scenario", "")) for q in all_questions])
    gts = [q.get("groundTruth") or "UNKNOWN" for q in all_questions]
    diffs = [_norm_difficulty(_get(q, "annotations", "difficulty")) for q in all_questions]

    fig, axes = plt.subplots(1, 2, figsize=(14, 5), constrained_layout=True)

    # Left: by ground truth
    ax = axes[0]
    gt_groups = ["NO", "YES", "AMBIGUOUS"]
    data = [word_counts[[i for i, g in enumerate(gts) if g == gt]] for gt in gt_groups]
    ax.boxplot(data, labels=gt_groups, showfliers=False)
    ax.set_title("Scenario word count by ground truth")
    ax.set_ylabel("Words")

    # Right: by difficulty
    ax = axes[1]
    diff_groups = ["EASY", "MEDIUM", "HARD"]
    data = [word_counts[[i for i, d in enumerate(diffs) if d == diff]] for diff in diff_groups]
    ax.boxplot(data, labels=diff_groups, showfliers=False)
    ax.set_title("Scenario word count by difficulty")
    ax.set_ylabel("Words")

    _save(fig, img_dir / "scenario_length.png")

    # ------------------------------------------------------------------
    # subdomain_ground_truth.png (top subdomains x groundTruth)
    # ------------------------------------------------------------------
    # NOTE: claimDirection is not present in the current annotation schema.
    fig, ax = plt.subplots(figsize=(12, 5), constrained_layout=True)

    subdomains = [_norm_subdomain(_get(q, "annotations", "subdomain")) for q in all_questions]
    sub_counts = Counter(subdomains)
    top_subs = [s for s, _ in sub_counts.most_common(10)]
    sub_display = [s if s in top_subs else "OTHER" for s in subdomains]

    subs_order = top_subs + (["OTHER"] if any(s == "OTHER" for s in sub_display) else [])
    gt_order = ["NO", "YES", "AMBIGUOUS"]
    colors = {"NO": "#e74c3c", "YES": "#27ae60", "AMBIGUOUS": "#f39c12"}

    counts = {s: Counter() for s in subs_order}
    for s, gt in zip(sub_display, gts):
        counts[s][gt] += 1

    x = np.arange(len(subs_order))
    bottoms = np.zeros(len(subs_order))
    for gt in gt_order:
        vals = np.array([counts[s].get(gt, 0) for s in subs_order])
        ax.bar(x, vals, bottom=bottoms, label=gt, color=colors[gt])
        bottoms += vals

    ax.set_title("Ground truth by subdomain (top 10)")
    ax.set_ylabel("Count")
    ax.set_xticks(x)
    ax.set_xticklabels(subs_order, rotation=30, ha="right")
    ax.legend(title="Ground truth", ncol=3, fontsize=8)
    _save(fig, img_dir / "subdomain_ground_truth.png")

    # ------------------------------------------------------------------
    # inter_annotator.png (GT, Pearl level, trap type by annotator)
    # ------------------------------------------------------------------
    fig, axes = plt.subplots(1, 3, figsize=(18, 5), constrained_layout=True)

    authors = list(author_counts.keys())

    # (1) Ground truth by annotator
    ax = axes[0]
    gt_order = ["NO", "YES", "AMBIGUOUS"]
    bottoms = np.zeros(len(authors))
    for gt in gt_order:
        vals = np.array([
            sum(1 for q in by_author[a] if (q.get("groundTruth") or "UNKNOWN") == gt)
            for a in authors
        ])
        ax.bar(authors, vals, bottom=bottoms, label=gt, color=colors.get(gt, "#95a5a6"))
        bottoms += vals
    ax.set_title("Ground truth by annotator")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=15)
    ax.legend(fontsize=8)

    # (2) Pearl level by annotator
    ax = axes[1]
    pl_order = ["L1", "L2", "L3"]
    pl_colors = {"L1": "#3498db", "L2": "#9b59b6", "L3": "#1abc9c"}
    bottoms = np.zeros(len(authors))
    for pl in pl_order:
        vals = np.array([
            sum(1 for q in by_author[a] if (_get(q, "annotations", "pearlLevel", default="UNKNOWN") or "UNKNOWN") == pl)
            for a in authors
        ])
        ax.bar(authors, vals, bottom=bottoms, label=pl, color=pl_colors[pl])
        bottoms += vals
    ax.set_title("Pearl level by annotator")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=15)
    ax.legend(fontsize=8)

    # (3) Trap type by annotator (NO only)
    ax = axes[2]
    # Pick top trap types overall (NO-only) and group rest into OTHER.
    top_trap_types = [t for t, _ in trap_counts.most_common(6)]
    trap_palette = ["#e67e22", "#d35400", "#f39c12", "#c0392b", "#8e44ad", "#2980b9", "#7f8c8d"]
    bottoms = np.zeros(len(authors))
    for i, tt in enumerate(top_trap_types + ["OTHER"]):
        vals = []
        for a in authors:
            qs = [q for q in by_author[a] if q.get("groundTruth") == "NO"]
            if tt == "OTHER":
                vals.append(
                    sum(
                        1
                        for q in qs
                        if (_get(q, "annotations", "trapType", default="UNKNOWN") not in top_trap_types)
                    )
                )
            else:
                vals.append(sum(1 for q in qs if _get(q, "annotations", "trapType") == tt))
        vals = np.array(vals)
        ax.bar(authors, vals, bottom=bottoms, label=tt, color=trap_palette[i % len(trap_palette)])
        bottoms += vals
    ax.set_title("Trap type by annotator (NO only)")
    ax.set_ylabel("Count")
    ax.tick_params(axis="x", rotation=15)
    ax.legend(fontsize=7, ncol=2)

    _save(fig, img_dir / "inter_annotator.png")

    # ------------------------------------------------------------------
    # similarity_analysis.png + tsne_visualization.png (embeddings)
    # ------------------------------------------------------------------
    scenarios = [q.get("scenario", "") for q in all_questions]
    embeddings = _compute_embeddings(scenarios)

    # Cosine similarity matrix (since we normalized embeddings)
    sim = embeddings @ embeddings.T

    # similarity_analysis.png
    fig, axes = plt.subplots(1, 2, figsize=(16, 6), constrained_layout=True)

    # Left: distribution of similarities (upper triangle)
    ax = axes[0]
    tri = sim[np.triu_indices(sim.shape[0], k=1)]
    ax.hist(tri, bins=50, color="#3498db", edgecolor="white")
    ax.set_title("Pairwise cosine similarity")
    ax.set_xlabel("Similarity")
    ax.set_ylabel("Count")

    # Right: similarity matrix heatmap
    ax = axes[1]
    im = ax.imshow(sim, vmin=-0.2, vmax=1.0, cmap="viridis", aspect="auto")
    ax.set_title("Similarity matrix")
    ax.set_xticks([])
    ax.set_yticks([])
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    _save(fig, img_dir / "similarity_analysis.png")

    # tsne_visualization.png
    from sklearn.manifold import TSNE

    tsne = TSNE(n_components=2, random_state=42, init="pca", learning_rate="auto", perplexity=30)
    coords = tsne.fit_transform(embeddings)

    # 2x2 grid improves readability and adds a view colored by subdomain.
    fig, axes = plt.subplots(2, 2, figsize=(14, 10), constrained_layout=True)

    # Ground truth coloring
    ax = axes[0, 0]
    for gt in ["NO", "YES", "AMBIGUOUS"]:
        idx = [i for i, g in enumerate(gts) if g == gt]
        ax.scatter(coords[idx, 0], coords[idx, 1], s=10, alpha=0.7, label=gt, color=colors[gt])
    ax.set_title("t-SNE colored by ground truth")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.legend(fontsize=8)


    # Pearl level x ground truth (combined) coloring
    ax = axes[0, 1]
    pls = [(_get(q, "annotations", "pearlLevel", default="UNKNOWN") or "UNKNOWN") for q in all_questions]

    valid_pls = ["L1", "L2", "L3"]
    # Ordering chosen to match requested legend ordering (e.g., L1 - YES, L1 - NO, ...)
    valid_gts = ["YES", "NO", "AMBIGUOUS"]
    base_order = [f"{pl} - {gt}" for pl in valid_pls for gt in valid_gts]

    combo = []
    for pl, gt in zip(pls, gts):
        pl_n = pl if pl in valid_pls else "OTHER"
        gt_n = gt if gt in valid_gts else "OTHER"
        combo.append(f"{pl_n} - {gt_n}")

    extra = sorted(set(combo) - set(base_order))
    combo_order = base_order + extra

    cmap = plt.get_cmap("tab20")
    combo_colors = {lab: cmap(i) for i, lab in enumerate(base_order)}
    for lab in extra:
        combo_colors[lab] = "#7f8c8d"

    for lab in combo_order:
        idx = [i for i, x in enumerate(combo) if x == lab]
        if not idx:
            continue
        ax.scatter(coords[idx, 0], coords[idx, 1], s=10, alpha=0.7, label=lab, color=combo_colors[lab])
    ax.set_title("t-SNE colored by Pearl level x ground truth")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.legend(fontsize=6, ncol=3)

    # Trap type coloring (grouped)
    ax = axes[1, 0]
    traps_all = [(_get(q, "annotations", "trapType", default="NONE") or "NONE") for q in all_questions]
    trap_groups = set(top_trap_types + ["NONE", "OTHER"])
    grouped = []
    for t in traps_all:
        if t in top_trap_types or t == "NONE":
            grouped.append(t)
        else:
            grouped.append("OTHER")
    trap_colors = {
        "NONE": "#95a5a6",
        "OTHER": "#7f8c8d",
        **{t: trap_palette[i % len(trap_palette)] for i, t in enumerate(top_trap_types)},
    }
    for t in ["NONE"] + top_trap_types + ["OTHER"]:
        idx = [i for i, x in enumerate(grouped) if x == t]
        if not idx:
            continue
        ax.scatter(coords[idx, 0], coords[idx, 1], s=10, alpha=0.7, label=t, color=trap_colors[t])
    ax.set_title("t-SNE colored by trap type")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.legend(fontsize=7, ncol=2)

    # Subdomain coloring (top 8 + OTHER)
    ax = axes[1, 1]
    subdomains = [_norm_subdomain(_get(q, "annotations", "subdomain")) for q in all_questions]
    sub_counts = Counter(subdomains)
    top_subs = [s for s, _ in sub_counts.most_common(8)]
    sub_grouped = [s if s in top_subs else "OTHER" for s in subdomains]
    sub_palette = plt.get_cmap("tab10")
    sub_colors = {s: sub_palette(i) for i, s in enumerate(top_subs)}
    sub_colors["OTHER"] = "#7f8c8d"
    for s in top_subs + ["OTHER"]:
        idx = [i for i, x in enumerate(sub_grouped) if x == s]
        if not idx:
            continue
        ax.scatter(coords[idx, 0], coords[idx, 1], s=10, alpha=0.7, label=s, color=sub_colors[s])
    ax.set_title("t-SNE colored by subdomain")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.legend(fontsize=7, ncol=2)

    _save(fig, img_dir / "tsne_visualization.png")

    print("Done generating images!")


if __name__ == "__main__":
    main()

