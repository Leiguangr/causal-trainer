#!/usr/bin/env python3
"""
Generate consistent statistics for the report.
This script queries the database and exported dataset to produce
accurate numbers for all report sections.
"""

import sqlite3
import json
from collections import defaultdict
from pathlib import Path

# Paths
DB_PATH = Path(__file__).parent.parent / 'prisma' / 'dev.db'
DATASET_PATH = Path(__file__).parent.parent / 'data' / 'groupG_Leiguang_Ren_dataset.json'


def get_db_stats():
    """Get statistics from the database (unvalidated pool)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, pearlLevel, groundTruth, difficulty, trapType, finalScore, 
               validationStatus, isLLMGenerated, initialAuthor
        FROM Question
    ''')
    all_cases = cursor.fetchall()
    conn.close()
    
    return all_cases


def get_export_stats():
    """Get statistics from the final exported dataset."""
    with open(DATASET_PATH) as f:
        dataset = json.load(f)
    return dataset['cases']


def calculate_stats(cases, source_name):
    """Calculate all statistics for a set of cases."""
    stats = {
        'total': len(cases),
        'pearl_level': defaultdict(int),
        'difficulty': defaultdict(int),
        'label': defaultdict(int),
        'trap_prefix': defaultdict(int),
        'l1_labels': defaultdict(int),
        'l2_labels': defaultdict(int),
        'l3_labels': defaultdict(int),
        'score_ranges': defaultdict(int),
        'difficulty_by_level': {
            'L1': defaultdict(int),
            'L2': defaultdict(int),
            'L3': defaultdict(int)
        }
    }
    
    for case in cases:
        # Handle both dict and sqlite3.Row
        if isinstance(case, dict):
            pearl = case.get('pearlLevel') or case.get('pearl_level')
            diff = case.get('difficulty')
            label = case.get('groundTruth') or case.get('label')
            trap_obj = case.get('trap', {})
            trap = case.get('trapType') or (trap_obj.get('type', '') if isinstance(trap_obj, dict) else '')
            score = case.get('finalScore') or case.get('final_score')
        else:
            # sqlite3.Row - access by column name
            pearl = case['pearlLevel']
            diff = case['difficulty']
            label = case['groundTruth']
            trap = case['trapType'] or ''
            score = case['finalScore']
        
        # Pearl level
        stats['pearl_level'][pearl] += 1
        
        # Difficulty
        diff_normalized = diff if diff in ['Easy', 'Medium', 'Hard'] else 'Unknown'
        stats['difficulty'][diff_normalized] += 1
        stats['difficulty_by_level'][pearl][diff_normalized] += 1
        
        # Label (overall and by level)
        stats['label'][label] += 1
        if pearl == 'L1':
            stats['l1_labels'][label] += 1
        elif pearl == 'L2':
            stats['l2_labels'][label] += 1
        elif pearl == 'L3':
            stats['l3_labels'][label] += 1
        
        # Trap prefix
        if trap:
            prefix = trap.split(':')[0] if ':' in str(trap) else str(trap)[:2]
            stats['trap_prefix'][prefix] += 1
        
        # Score ranges
        if score is not None:
            if score == 10.0:
                stats['score_ranges']['10.0'] += 1
            elif score >= 9.0:
                stats['score_ranges']['9.0-9.9'] += 1
            elif score >= 8.0:
                stats['score_ranges']['8.0-8.9'] += 1
            elif score >= 6.0:
                stats['score_ranges']['6.0-7.9'] += 1
            else:
                stats['score_ranges']['<6.0'] += 1
    
    return stats


def print_stats(stats, name):
    """Print formatted statistics."""
    print(f"\n{'=' * 60}")
    print(f"{name}")
    print(f"{'=' * 60}")
    
    print(f"\nTotal cases: {stats['total']}")
    
    print(f"\n--- Pearl Level Distribution ---")
    for level in ['L1', 'L2', 'L3']:
        count = stats['pearl_level'][level]
        pct = count / stats['total'] * 100 if stats['total'] > 0 else 0
        print(f"  {level}: {count} ({pct:.1f}%)")
    
    print(f"\n--- Difficulty Distribution ---")
    for diff in ['Easy', 'Medium', 'Hard']:
        count = stats['difficulty'][diff]
        pct = count / stats['total'] * 100 if stats['total'] > 0 else 0
        print(f"  {diff}: {count} ({pct:.1f}%)")
    
    print(f"\n--- Difficulty by Pearl Level ---")
    for level in ['L1', 'L2', 'L3']:
        level_total = stats['pearl_level'][level]
        print(f"  {level}:")
        for diff in ['Easy', 'Medium', 'Hard']:
            count = stats['difficulty_by_level'][level][diff]
            pct = count / level_total * 100 if level_total > 0 else 0
            print(f"    {diff}: {count} ({pct:.1f}%)")
    
    print(f"\n--- L1 Label Distribution ---")
    for label in ['YES', 'NO', 'AMBIGUOUS']:
        count = stats['l1_labels'][label]
        print(f"  {label}: {count}")
    
    print(f"\n--- L2 Label Distribution ---")
    for label in ['NO', 'YES']:
        count = stats['l2_labels'][label]
        if count > 0:
            print(f"  {label}: {count}")
    
    print(f"\n--- L3 Label Distribution ---")
    for label in ['VALID', 'INVALID', 'CONDITIONAL']:
        count = stats['l3_labels'][label]
        print(f"  {label}: {count}")
    
    if stats['score_ranges']:
        print(f"\n--- Score Distribution ---")
        for range_name in ['10.0', '9.0-9.9', '8.0-8.9', '6.0-7.9', '<6.0']:
            count = stats['score_ranges'][range_name]
            pct = count / stats['total'] * 100 if stats['total'] > 0 else 0
            print(f"  {range_name}: {count} ({pct:.1f}%)")


def generate_latex_tables(unval_stats, val_stats, final_stats):
    """Generate LaTeX table data for the report."""
    print("\n" + "=" * 60)
    print("LATEX TABLE DATA")
    print("=" * 60)
    
    # Pearl Level Table
    print("\n--- Table 2: Pearl Level Distribution ---")
    print("Level & Unval & % & Valid & % & Final & % \\\\")
    for level in ['L1', 'L2', 'L3']:
        u = unval_stats['pearl_level'][level]
        u_pct = u / unval_stats['total'] * 100
        v = val_stats['pearl_level'][level]
        v_pct = v / val_stats['total'] * 100
        f = final_stats['pearl_level'][level]
        f_pct = f / final_stats['total'] * 100
        print(f"{level} & {u} & {u_pct:.1f}% & {v} & {v_pct:.1f}% & {f} & {f_pct:.0f}% \\\\")
    print(f"Total & {unval_stats['total']} & 100% & {val_stats['total']} & 100% & {final_stats['total']} & 100% \\\\")
    
    # Difficulty Table
    print("\n--- Table: Difficulty Distribution ---")
    print("Difficulty & Unval & % & Valid & % & Final & Target \\\\")
    for diff in ['Easy', 'Medium', 'Hard']:
        u = unval_stats['difficulty'][diff]
        u_pct = u / unval_stats['total'] * 100
        v = val_stats['difficulty'][diff]
        v_pct = v / val_stats['total'] * 100
        f = final_stats['difficulty'][diff]
        target = 25 if diff != 'Medium' else 50
        print(f"{diff} & {u} & {u_pct:.1f}% & {v} & {v_pct:.1f}% & {f} & {target}% \\\\")
    print(f"Total & {unval_stats['total']} & 100% & {val_stats['total']} & 100% & {final_stats['total']} & 100% \\\\")


def main():
    print("Generating Report Statistics")
    print("=" * 60)
    
    # Get data
    db_cases = get_db_stats()
    export_cases = get_export_stats()
    
    # Calculate unvalidated stats (all cases in DB)
    unval_stats = calculate_stats(db_cases, "Unvalidated")
    
    # Calculate validated stats (score >= 8)
    validated_cases = [c for c in db_cases if c['finalScore'] is not None and c['finalScore'] >= 8]
    val_stats = calculate_stats(validated_cases, "Validated (score >= 8)")
    
    # Calculate final export stats
    final_stats = calculate_stats(export_cases, "Final Export")
    
    # Print all stats
    print_stats(unval_stats, "UNVALIDATED POOL (Database)")
    print_stats(val_stats, "VALIDATED (Score >= 8)")
    print_stats(final_stats, "FINAL EXPORT (360 cases)")
    
    # Generate LaTeX table data
    generate_latex_tables(unval_stats, val_stats, final_stats)
    
    # Verification
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    print(f"Unvalidated total: {unval_stats['total']}")
    print(f"L1+L2+L3 = {unval_stats['pearl_level']['L1']} + {unval_stats['pearl_level']['L2']} + {unval_stats['pearl_level']['L3']} = {sum(unval_stats['pearl_level'].values())}")
    print(f"Easy+Medium+Hard = {unval_stats['difficulty']['Easy']} + {unval_stats['difficulty']['Medium']} + {unval_stats['difficulty']['Hard']} = {sum(unval_stats['difficulty'].values())}")
    
    if unval_stats['total'] == sum(unval_stats['pearl_level'].values()) == sum(unval_stats['difficulty'].values()):
        print("✅ All totals are consistent!")
    else:
        print("❌ Totals are inconsistent!")


if __name__ == '__main__':
    main()
