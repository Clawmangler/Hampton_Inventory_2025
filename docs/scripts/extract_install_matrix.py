#!/usr/bin/env python3
"""
Extract Hampton/Hilton Install_Matrix.pdf into JSON/CSV for the inventory web page.

Usage:
  python scripts/extract_install_matrix.py --pdf Install_Matrix.pdf --out ./data

Notes:
- Designed for the specific table structure in Install_Matrix.pdf.
- Produces a stable `item_id` for each row: "<SPEC>-<ordinal>-p<PAGE>".
"""
import argparse, os, re, json
import numpy as np
import pandas as pd
import pdfplumber

def tab_to_df(tab):
    cols=max(len(r) for r in tab)
    padded=[(r+[None]*(cols-len(r))) for r in tab]
    return pd.DataFrame(padded)

def normalize_roomtype(label):
    if not label:
        return {"id": None, "label": "", "name": ""}
    s=str(label).replace("\\n"," ").strip()
    m=re.search(r'ID-?\\s*(\\d+)', s)
    id_ = f"ID-{m.group(1)}" if m else None
    name = re.sub(r'\\s*ID-?\\s*\\d+.*','', s).strip()
    return {"id": id_, "label": s, "name": name}

def parse_number(x):
    if x is None:
        return None
    if isinstance(x,(int,float)):
        if isinstance(x,float) and np.isnan(x):
            return None
        return x
    s=str(x).strip()
    if s=="" or s.lower()=="none":
        return None
    s2=s.replace(",","")
    if re.fullmatch(r'-?\\d+(\\.\\d+)?', s2):
        return int(s2) if "." not in s2 else float(s2)
    return s

def rekey_qty_dict(d):
    if not isinstance(d, dict):
        return {}
    out={}
    for k,v in d.items():
        if isinstance(k,str) and re.fullmatch(r'ID-\\d+', k):
            out[k]=v
        else:
            m=re.search(r'ID-?\\s*(\\d+)', str(k))
            out[f"ID-{m.group(1)}" if m else str(k)] = v
    return out

def looks_like_category(desc: str) -> bool:
    t=(desc or "").strip()
    if not t:
        return False
    if t.startswith("*"):
        return False
    U=t.upper()
    # common disclaimers / notes
    if ("QTY" in U or "QTYS" in U) and ("GC" in U or "CONFIRM" in U or "VERIFY" in U or "MUST" in U):
        return False
    if "SUBJECT TO CHANGE" in U or "PRICING" in U or "PREMEASURE" in U:
        return False

    wc=len(t.split())
    has_digit=bool(re.search(r'\\d', t))
    if t.isupper() and len(t)<=120:
        return True
    if t.endswith(":"):
        return True
    if wc<=10 and len(t)<=120 and not has_digit:
        return True
    return False

def parse_guestroom_tables(page_tables):
    items=[]
    room_inventory=[]
    roomtype_meta=None
    current_category=None
    current_note=None

    cols=list(range(2,16))  # room type columns

    for p,tab in page_tables:
        df=tab_to_df(tab)

        # header row has room type labels
        roomtype_meta=[normalize_roomtype(df.iloc[0,c]) for c in cols]

        start_idxs=df.index[df[0].astype(str).str.contains("Hilton Spec", na=False)].tolist()
        start=start_idxs[0] if start_idxs else None

        # floor counts above the item list
        if start is not None:
            for idx in range(1,start):
                floor=str(df.iloc[idx,1]).strip() if df.iloc[idx,1] is not None else ""
                if "Floor" in floor:
                    counts={}
                    for j,c in enumerate(cols):
                        val=parse_number(df.iloc[idx,c])
                        if val is None:
                            continue
                        rid=roomtype_meta[j]["id"] or roomtype_meta[j]["label"]
                        counts[rid]=val
                    total=parse_number(df.iloc[idx,17])
                    room_inventory.append({"floor": floor, "counts": counts, "total": total, "source_page": p+1})

        if start is None:
            continue

        for idx in range(start+1, len(df)):
            spec=df.iloc[idx,0]
            desc=df.iloc[idx,1]
            spec_s=str(spec).strip() if spec is not None else ""
            desc_s=str(desc).strip() if desc is not None else ""

            if spec_s=="" and desc_s=="":
                continue

            # section header / note row
            if (spec_s=="" or spec_s.lower()=="none") and desc_s:
                if looks_like_category(desc_s):
                    current_category=desc_s
                else:
                    current_note=desc_s
                continue

            if spec_s and spec_s.lower()!="none":
                qtys={}
                for j,c in enumerate(cols):
                    val=parse_number(df.iloc[idx,c])
                    if val is None or val=="":
                        continue
                    rid=roomtype_meta[j]["id"] or roomtype_meta[j]["label"]
                    qtys[rid]=val

                items.append({
                    "spec": spec_s,
                    "description": desc_s,
                    "category": current_category,
                    "section_note": current_note,
                    "area": "Guestrooms",
                    "room_type_quantities": rekey_qty_dict(qtys),
                    "attic_stock": parse_number(df.iloc[idx,16]),
                    "total": parse_number(df.iloc[idx,17]),
                    "uom": str(df.iloc[idx,18]).strip() if df.iloc[idx,18] not in [None,""] else "",
                    "notes": str(df.iloc[idx,19]).strip() if df.iloc[idx,19] not in [None,""] else "",
                    "source_page": p+1
                })

    return pd.DataFrame(items), pd.DataFrame(room_inventory), roomtype_meta

def parse_public_tables(page_tables):
    items=[]
    current_category=None
    current_note=None

    for p,tab in page_tables:
        df=tab_to_df(tab)
        for _,row in df.iterrows():
            spec=str(row[0]).strip() if row[0] is not None else ""
            desc=str(row[1]).strip() if row[1] is not None else ""
            qty=row[17] if 17 in row.index else None
            uom=row[18] if 18 in row.index else None
            notes=row[19] if 19 in row.index else None

            if spec.lower().startswith("hilton spec"):
                continue

            if (spec=="" or spec.lower()=="none") and desc and (qty in [None,"","0","None"]):
                if looks_like_category(desc):
                    current_category=desc
                else:
                    current_note=desc
                continue

            if spec and spec.lower()!="none":
                items.append({
                    "spec": spec,
                    "description": desc,
                    "category": current_category,
                    "section_note": current_note,
                    "area": "Public Areas",
                    "room_type_quantities": None,
                    "attic_stock": None,
                    "total": parse_number(qty),
                    "uom": str(uom).strip() if uom not in [None,""] else "",
                    "notes": str(notes).strip() if notes not in [None,""] else "",
                    "source_page": p+1
                })
    return pd.DataFrame(items)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Path to Install_Matrix.pdf")
    ap.add_argument("--out", required=True, help="Output folder (will write items.json/items.csv/etc)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    page_tables=[]
    with pdfplumber.open(args.pdf) as pdf:
        for i,page in enumerate(pdf.pages):
            for tab in (page.extract_tables() or []):
                page_tables.append((i,tab))

    # In this PDF: first 4 tables = guestroom section; last 3 tables = public areas.
    guest_items, room_inventory, roomtypes = parse_guestroom_tables(page_tables[:4])
    public_items = parse_public_tables(page_tables[4:])

    combined=pd.concat([guest_items, public_items], ignore_index=True).replace({np.nan:None})

    # stable item_id (spec + ordinal + source_page)
    combined["spec"]=combined["spec"].astype(str).str.strip()
    combined["__ord"]=combined.groupby("spec").cumcount()+1
    combined["item_id"]=combined.apply(lambda r: f"{r['spec']}-{int(r['__ord']):02d}-p{int(r['source_page']):02d}", axis=1)
    combined=combined.drop(columns=["__ord"])

    # editable fields defaults
    for k,v in {
        "vendor":"",
        "model":"",
        "part_number":"",
        "unit_cost":"",
        "warranty_months":"",
        "warranty_start":"",
        "warranty_end":"",
        "installed_date":"",
        "last_replaced":"",
        "on_hand":"",
        "min_on_hand":"",
        "storage_location":"",
        "link":"",
        "image_urls":[],
        "tags":[]
    }.items():
        combined[k]=[v]*len(combined)

    combined.to_csv(os.path.join(args.out,"items.csv"), index=False)

    with open(os.path.join(args.out,"items.json"),"w",encoding="utf-8") as f:
        json.dump(combined.to_dict(orient="records"), f, indent=2, ensure_ascii=False)

    with open(os.path.join(args.out,"room_types.json"),"w",encoding="utf-8") as f:
        json.dump(roomtypes, f, indent=2, ensure_ascii=False)

    with open(os.path.join(args.out,"room_inventory_by_floor.json"),"w",encoding="utf-8") as f:
        json.dump(room_inventory.to_dict(orient="records"), f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(combined)} items to {args.out}")

if __name__ == "__main__":
    main()
