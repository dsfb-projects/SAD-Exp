import os
import math
import json
import ast
import io
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import pandas as pd

# In production, serve the built Vite frontend from backend
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path='')
CORS(app)

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            codigo     INTEGER PRIMARY KEY,
            item       TEXT,
            nome       TEXT,
            area_m2    FLOAT,
            peso_kg    FLOAT,
            empilhavel BOOLEAN DEFAULT FALSE,
            miscelanea BOOLEAN DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS trucks (
            id_carreta   SERIAL PRIMARY KEY,
            nome         TEXT,
            area_base_m2 FLOAT
        );
        CREATE TABLE IF NOT EXISTS sales_orders (
            id        SERIAL PRIMARY KEY,
            num_venda TEXT,
            cliente   TEXT,
            produtos  JSONB
        );
    """)
    # Migrations for existing deployments
    cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS miscelanea BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE trucks ADD COLUMN IF NOT EXISTS nome TEXT")
    conn.commit()
    conn.close()
    _seed_trucks()

def _seed_trucks():
    """Pre-populate vehicle types if table is empty."""
    veiculos = [
        ('Furgão / VUC', 7.0),
        ('Toco', 14.4),
        ('Truck', 18.0),
        ('Carreta Simples', 34.8),
        ('Carreta Baú', 33.6),
    ]
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM trucks")
    count = cur.fetchone()[0]
    if count == 0:
        for nome, area in veiculos:
            cur.execute("INSERT INTO trucks (nome, area_base_m2) VALUES (%s, %s)", (nome, area))
    conn.commit()
    conn.close()

init_db()

# ─── PRODUCTS ────────────────────────────────────────────────────────────────

@app.route('/api/products', methods=['GET'])
def list_products():
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM products ORDER BY codigo")
    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        """INSERT INTO products (codigo, item, nome, area_m2, peso_kg, empilhavel, miscelanea)
           VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *""",
        (data['codigo'], data['item'], data['nome'],
         data['area_m2'], data['peso_kg'], data['empilhavel'], data.get('miscelanea', False))
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()
    return jsonify(dict(row)), 201

@app.route('/api/products/<int:pid>', methods=['PUT'])
def update_product(pid):
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        """UPDATE products SET codigo=%s, item=%s, nome=%s, area_m2=%s,
           peso_kg=%s, empilhavel=%s, miscelanea=%s WHERE codigo=%s RETURNING *""",
        (data['codigo'], data['item'], data['nome'],
         data['area_m2'], data['peso_kg'], data['empilhavel'], data.get('miscelanea', False), pid)
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))

@app.route('/api/products/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE codigo=%s", (pid,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# ─── TRUCKS ──────────────────────────────────────────────────────────────────

@app.route('/api/trucks', methods=['GET'])
def list_trucks():
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute("SELECT id_carreta AS id, nome, area_base_m2 FROM trucks ORDER BY id_carreta")
    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/trucks', methods=['POST'])
def create_truck():
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        "INSERT INTO trucks (nome, area_base_m2) VALUES (%s, %s) RETURNING id_carreta AS id, nome, area_base_m2",
        (data['nome'], data['area_base_m2'])
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()
    return jsonify(dict(row)), 201

@app.route('/api/trucks/<int:tid>', methods=['PUT'])
def update_truck(tid):
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        "UPDATE trucks SET nome=%s, area_base_m2=%s WHERE id_carreta=%s RETURNING id_carreta AS id, nome, area_base_m2",
        (data['nome'], data['area_base_m2'], tid)
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(row))

@app.route('/api/trucks/<int:tid>', methods=['DELETE'])
def delete_truck(tid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM trucks WHERE id_carreta=%s", (tid,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# ─── SALES ORDERS ─────────────────────────────────────────────────────────────

@app.route('/api/orders', methods=['GET'])
def list_orders():
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM sales_orders ORDER BY id")
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if isinstance(d['produtos'], str):
            d['produtos'] = json.loads(d['produtos'])
        result.append(d)
    return jsonify(result)

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        "INSERT INTO sales_orders (num_venda, cliente, produtos) VALUES (%s, %s, %s) RETURNING *",
        (data['num_venda'], data['cliente'], json.dumps(data['produtos']))
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()
    d = dict(row)
    if isinstance(d['produtos'], str):
        d['produtos'] = json.loads(d['produtos'])
    return jsonify(d), 201

@app.route('/api/orders/<int:oid>', methods=['PUT'])
def update_order(oid):
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        "UPDATE sales_orders SET num_venda=%s, cliente=%s, produtos=%s WHERE id=%s RETURNING *",
        (data['num_venda'], data['cliente'], json.dumps(data['produtos']), oid)
    )
    row = cur.fetchone()
    conn.commit()
    conn.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    d = dict(row)
    if isinstance(d['produtos'], str):
        d['produtos'] = json.loads(d['produtos'])
    return jsonify(d)

@app.route('/api/orders/<int:oid>', methods=['DELETE'])
def delete_order(oid):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM sales_orders WHERE id=%s", (oid,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# ─── EXCEL IMPORT ─────────────────────────────────────────────────────────────

def _scalar(val):
    """Safely extract a scalar from a value that might be a pandas Series."""
    import pandas as pd
    if isinstance(val, pd.Series):
        return val.iloc[0]
    return val

def _read_excel_flexible(file_bytes):
    """Try reading the Excel file from known sheet names, fall back to first sheet."""
    import pandas as pd
    preferred = ['Resultados', 'Planilha1', 'Sheet1', 'Produtos']
    xls = pd.ExcelFile(io.BytesIO(file_bytes))
    for name in preferred:
        if name in xls.sheet_names:
            return pd.read_excel(io.BytesIO(file_bytes), sheet_name=name)
    return pd.read_excel(io.BytesIO(file_bytes), sheet_name=0)

def _normalise_product_columns(df):
    """
    Rename columns to canonical names.
    Handles duplicates by keeping only the FIRST column that maps to each target.
    Also detects mm² values and converts them to m².
    """
    import pandas as pd
    df.columns = [str(c).strip() for c in df.columns]

    # Priority-ordered patterns: first match wins for each target
    patterns = [
        ('Código',           lambda lc: 'código' in lc or 'codigo' in lc or lc == 'cod' or lc.startswith('cod.')),
        ('Item',             lambda lc: lc == 'item' or 'descri' in lc or ('produto' in lc and 'empilh' not in lc)),
        ('Area (m²)',        lambda lc: 'area' in lc or 'área' in lc),
        ('Peso (kg)',        lambda lc: 'peso' in lc),
        ('Empilhável (s/n)', lambda lc: 'empilh' in lc),
    ]

    assigned = {}   # target -> original col name (first match only)
    for col in df.columns:
        lc = col.lower()
        for target, match_fn in patterns:
            if target not in assigned and match_fn(lc):
                assigned[target] = col
                break

    # Build rename map from original name -> target
    rename_map = {orig: target for target, orig in assigned.items()}
    df = df.rename(columns=rename_map)

    # Drop any duplicate columns that appeared after renaming
    df = df.loc[:, ~df.columns.duplicated(keep='first')]

    # Detect mm² area values and convert to m² (values > 1000 are almost certainly mm²)
    if 'Area (m²)' in df.columns:
        sample = df['Area (m²)'].dropna()
        if len(sample) > 0 and pd.to_numeric(sample, errors='coerce').median() > 100:
            df['Area (m²)'] = pd.to_numeric(df['Area (m²)'], errors='coerce') / 1_000_000

    return df

@app.route('/api/import/products', methods=['POST'])
def import_products_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    try:
        file_bytes = f.read()
        df = _read_excel_flexible(file_bytes)
        df = _normalise_product_columns(df)

        required = ['Código', 'Item', 'Area (m²)', 'Peso (kg)', 'Empilhável (s/n)']
        missing = [c for c in required if c not in df.columns]
        if missing:
            return jsonify({
                'error': f'Colunas não encontradas: {missing}. '
                         f'Colunas detectadas na planilha: {list(df.columns)}'
            }), 400

        conn = get_db()
        cur = conn.cursor()
        inserted = 0
        errors = []
        for idx, row in df.iterrows():
            try:
                raw_cod  = _scalar(row['Código'])
                raw_item = _scalar(row['Item'])
                raw_area = _scalar(row['Area (m²)'])
                raw_peso = _scalar(row['Peso (kg)'])
                raw_emp  = _scalar(row['Empilhável (s/n)'])

                # Skip completely empty rows
                if pd.isna(raw_cod) or pd.isna(raw_item):
                    continue

                codigo = int(float(str(raw_cod).strip()))
                item   = str(raw_item).strip()
                nome   = item.split('-', 1)[1].strip() if '-' in item else item

                area_val = pd.to_numeric(str(raw_area).replace(',', '.'), errors='coerce')
                if pd.isna(area_val):
                    area_val = 0.0
                area = float(area_val)

                peso_val = pd.to_numeric(str(raw_peso).replace(',', '.'), errors='coerce')
                if pd.isna(peso_val):
                    peso_val = 0.0
                peso = float(peso_val)

                emp = str(raw_emp).strip().lower() in ('sim', 'yes', 's', 'true', '1')

                cur.execute(
                    """INSERT INTO products (codigo, item, nome, area_m2, peso_kg, empilhavel, miscelanea)
                       VALUES (%s, %s, %s, %s, %s, %s, FALSE)
                       ON CONFLICT (codigo) DO UPDATE
                       SET item=%s, nome=%s, area_m2=%s, peso_kg=%s, empilhavel=%s""",
                    (codigo, item, nome, area, peso, emp,
                     item, nome, area, peso, emp)
                )
                inserted += 1
            except Exception as e:
                errors.append(f'Linha {idx + 2}: {e}')
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'upserted': inserted, 'errors': errors})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/import/orders', methods=['POST'])
def import_orders_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    try:
        df = pd.read_excel(io.BytesIO(f.read()), sheet_name=0)
        df.columns = [str(c).strip() for c in df.columns]

        rename_map = {}
        for col in df.columns:
            lc = col.lower()
            if 'venda' in lc or 'n°' in lc or 'numero' in lc or 'número' in lc:
                rename_map[col] = 'N° da Venda'
            elif 'cliente' in lc:
                rename_map[col] = 'Cliente'
            elif 'produto' in lc:
                rename_map[col] = 'Produtos'
        df.rename(columns=rename_map, inplace=True)

        required = ['N° da Venda', 'Cliente', 'Produtos']
        missing = [c for c in required if c not in df.columns]
        if missing:
            return jsonify({'error': f'Missing columns: {missing}. Found: {list(df.columns)}'}), 400

        conn = get_db()
        cur = conn.cursor()
        inserted = 0
        errors = []
        for _, row in df.iterrows():
            if pd.isna(row.get('Produtos')):
                continue
            try:
                num_venda = str(row['N° da Venda'])
                cliente = str(row['Cliente'])
                produtos = ast.literal_eval(str(row['Produtos']))
                cur.execute(
                    "INSERT INTO sales_orders (num_venda, cliente, produtos) VALUES (%s, %s, %s)",
                    (num_venda, cliente, json.dumps(produtos))
                )
                inserted += 1
            except Exception as e:
                errors.append(str(e))
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'inserted': inserted, 'errors': errors})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── TOTVS CSV IMPORT ────────────────────────────────────────────────────────

@app.route('/api/import/totvs', methods=['POST'])
def import_totvs():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    f = request.files['file']
    num_projeto = request.form.get('num_projeto', '').strip()
    cliente = request.form.get('cliente', '').strip()

    try:
        raw = f.read()
        content = None
        for enc in ['latin1', 'cp1252', 'utf-8']:
            try:
                content = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if content is None:
            return jsonify({'error': 'Não foi possível decodificar o arquivo.'}), 400

        df = pd.read_csv(io.StringIO(content), sep=';', dtype=str)
        df.columns = df.columns.str.strip()

        desc_col = next((c for c in df.columns if 'desc' in c.lower() and 'produto' in c.lower()), None)
        qty_col  = next((c for c in df.columns if 'qtd' in c.lower() and 'empenho' in c.lower()), None)
        pai_col  = next((c for c in df.columns if 'produto pai' in c.lower() or 'pai' == c.lower().strip()), None)

        if not desc_col or not qty_col:
            return jsonify({'error': f'Colunas esperadas não encontradas. Colunas no arquivo: {list(df.columns)}'}), 400

        if not num_projeto and pai_col:
            pais = df[pai_col].dropna().unique()
            if len(pais):
                num_projeto = str(pais[0]).strip()

        df[qty_col] = pd.to_numeric(df[qty_col].str.replace(',', '.'), errors='coerce').fillna(0)
        grouped = df.groupby(desc_col)[qty_col].sum().reset_index()

        conn = get_db()
        cur = dict_cursor(conn)
        cur.execute("SELECT codigo, nome, area_m2, peso_kg, empilhavel, miscelanea FROM products")
        catalog = {r['nome'].upper().strip(): dict(r) for r in cur.fetchall()}
        conn.close()

        matched = []
        unmatched = []
        suppressed = []

        for _, row in grouped.iterrows():
            desc = str(row[desc_col]).strip()
            qty  = int(row[qty_col])
            if qty <= 0 or desc.lower() == 'nan':
                continue

            prod = catalog.get(desc.upper().strip())
            if prod:
                if prod['miscelanea']:
                    suppressed.append({'descricao': desc, 'qtd': qty})
                else:
                    matched.append({
                        'codigo': prod['codigo'],
                        'nome': prod['nome'],
                        'area_m2': prod['area_m2'],
                        'peso_kg': prod['peso_kg'],
                        'qtd': qty,
                    })
            else:
                unmatched.append({'descricao': desc, 'qtd': qty})

        return jsonify({
            'ok': True,
            'num_projeto': num_projeto,
            'cliente': cliente,
            'matched': matched,
            'unmatched': unmatched,
            'suppressed': suppressed,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── PRODUCT SEED (historical TOTVS data) ────────────────────────────────────

_SEED_PRODUCTS = [
    # (codigo, nome, miscelanea)  — area_m2 and peso_kg filled in later
    (1001,"ARRUELA CUNHA M12",True),(1002,"ARRUELA M10 LISA",True),(1003,"ARRUELA M10 PRESSAO",True),
    (1004,"ARRUELA M12 LISA",True),(1005,"ARRUELA M12 LISA ACO INOX",True),(1006,"ARRUELA M12 PRESSAO",True),
    (1007,"ARRUELA M12 PRESSAO ACO INOX",True),(1008,"ARRUELA M16 LISA",True),(1009,"ARRUELA M16 LISA ACO INOX",True),
    (1010,"ARRUELA M16 PRESSAO",True),(1011,"ARRUELA P/ UNIDUT CONICO 1\" AU",True),(1012,"ARRUELA P/ UNIDUT CONICO 1.1/2",True),
    (1013,"BARRAMENTO CHAVE A VACUO",False),(1014,"BARRAMENTO DE ENTRADA SECCIONA",False),
    (1015,"BARRAMENTO ENTRADA",False),(1016,"BARRAMENTO P/ 02 PORTA-FUS CXP",False),
    (1017,"BUCHA P/ UNIDUT CONICO 1\" BU 1",True),(1018,"BUCHA P/ UNIDUT CONICO1.1/2\" B",True),
    (1019,"CABO 35MM2 NU COBRE",False),(1020,"CABO 50MM2 NU COBRE",False),(1021,"CABO 70MM2 NU COBRE",False),
    (1022,"CABO DE CONTROLE 20X1.5MM / P",False),(1023,"CABO DE CONTROLE 5X4,0MM / PR",False),
    (1024,"CABO DE CONTROLE BLINDADO 70C",False),(1025,"CABO DE CONTROLE SEM BLINDAGEM",False),
    (1026,"CABOPROTEGIDO15KV50MM2",False),(1027,"CAT 15KV 630A - NEOENERGIA",False),(1028,"CAT 36KV 630A",False),
    (1029,"CHAVE A VACUO 38KV NBI 170KV",False),(1030,"CHUMBADOR - M16",True),
    (1031,"CONECT INF BRONZE EST PINO M16",False),(1032,"CONECT SUP BRONZE EST PINO M16",False),
    (1033,"CONETOR BRONZE EST. ATERRAMENT",False),(1034,"CONETOR BRONZE EST. TRM 90 BAR",False),
    (1035,"CONETOR BRONZE EST. TRM RETO B",False),(1036,"CONETOR SUPORTE ANTICORONA P/",False),
    (1037,"CONETOR T ANTICORONA [TUBO-TUB",False),(1038,"CONETOR T BRONZE EST. CABO10A7",False),
    (1039,"CORDA EM NYLON 3/8",True),(1040,"DAILET DMT 100-X",False),
    (1041,"DISPOSITIVO DE ICAMENTO - TRAN",False),(1042,"ELETRODUTO FLEXIVEL 1\"",False),
    (1043,"ELETRODUTO FLEXIVEL 1.1/2 IPS",False),(1044,"ELETRODUTO RIGIDO 1 IPS",False),
    (1045,"ELETRODUTO RIGIDO 1.1/2 IPS",False),(1046,"ELO FUSIVEL 12T - 730MM",True),
    (1047,"ESTRUTURA BANCO SHUNT TRANSENER",False),(1048,"ESTRUTURA METALICA NEOENERGIA",False),
    (1049,"ESTRUTURA METALICA SIMEC ESTAG",False),(1050,"FI 400KVAR 8360V",False),
    (1051,"ISOLADOR SUPORTE MACICO TR-205",False),(1052,"ISOLADOR SUPORTE MACICO TR-208",False),
    (1053,"ISOLADOR SUPORTE MACICO TR-210",False),(1054,"ISOLADOR SUPORTE MACICO TR-225",False),
    (1055,"ISOLADOR SUPORTE MACICO TR-231",False),(1056,"ISOLADOR SUPORTE MACICO TR-267",False),
    (1057,"MG 634KVAR 16320V 50HZ",False),(1058,"MH 147,167KVAR 12930V",False),
    (1059,"MOITAO CADERNAL 03 ROLDANAS 45",False),(1060,"MOLA DE EXPULSAO DO TUBO CXP+",True),
    (1061,"PARA-RAIOS 12KVCL2 19134300",False),(1062,"PARA-RAIOS-36KV10KA-CL2CN",False),
    (1063,"PARAF CAB SEXT M12X30 INOX DIN",True),(1064,"PARAF. SXT M16X35 INOX 304",True),
    (1065,"PARAF. SXT M16X35 INOX 316",True),(1066,"PARAF.SXT M10X30",True),(1067,"PARAF.SXT M12X25 INOX",True),
    (1068,"PARAF.SXT M12X35 INOX",True),(1069,"PARAF.SXT M12X40",True),(1070,"PARAF.SXT M12X70",True),
    (1071,"PARAF.SXT M16X50",True),(1072,"PARAF.SXT M16X60",True),(1073,"PARAFUSO M12X45 GALV.FOGO",True),
    (1074,"PORCA M16 ACO INOX",True),(1075,"PORCA SEXT M10",True),(1076,"PORCA SEXT M12",True),(1077,"PORCA SEXT M16",True),
    (1078,"REATOR 0,07MH 270A 15KV 60HZ",False),(1079,"REATOR TIPO RFF- 125,557MH / 2",False),
    (1080,"SAV 36 KV 630 A",False),(1081,"SC CABO LIGACAO DOS CAP / PARA",False),
    (1082,"SC CAIXA-INTERLIGACAO NEOENERGI",False),(1083,"SC CAIXA-PAINEL SIMEC",False),
    (1084,"SC PORTA FUSIVEL EXPULSAO 20KV",False),(1085,"SUPORTE P/ BARRAMENTOS CXP 20K",False),
    (1086,"SUPORTE P/ BARRAMENTOS CXP 8KV",False),(1087,"TAMPA PARA DAILET DMT 100-X",False),
    (1088,"TAMPAO ANTICORONA P/ TUBO 3\"",False),(1089,"TAMPAO MT 100",True),
    (1090,"TC CLASSE 34.2KV IP 5A IS 1A",False),(1091,"TC15KV5/15/30-5A1,3FT25VA0,3",False),
    (1092,"TP CLASSE 34,2 UP 34500/V3 V U",False),(1093,"UNIDUT CONICO 1\" UCT 100C",True),
    (1094,"UNIDUT CONICO 1.1/2\" UCT 112C",True),(1095,"VERGALHAO COBRE 3/8\"X3,0M",False),
]

@app.route('/api/seed/fix-catalog', methods=['POST'])
def fix_catalog():
    """
    1. Set miscelanea=True for all hardware items (by keyword on nome).
    2. Insert missing key products estimated from TABELA MEDIDAS + PESO EQUIPAMENTOS.
    """
    MISC_KEYWORDS = [
        'ARRUELA', 'PARAF', 'PORCA', 'CHUMBADOR', 'CORDA EM NYLON',
        'MOLA DE EXPULSAO', 'ELO FUSIVEL', 'BUCHA P/ UNIDUT', 'UNIDUT CONICO', 'TAMPAO MT',
    ]
    # (nome, area_m2, peso_kg, empilhavel)
    # Sources: PESO EQUIPAMENTOS + TABELA MEDIDAS EMBALAGENS + Leo's catalog
    MISSING = [
        # Capacitores
        ('FI 400KVAR 8360V',                0.213, 50.0,  False),  # emb 3490004H01 aprox; PESO=50kg@400kvar
        ('MH 147,167KVAR 12930V',           0.213, 25.0,  False),  # similar dimensao; peso estimado
        # Reatores - RT42011060: 3 reatores em caixa 1348x450mm -> por unidade: 0.202m2
        ('REATOR 0,07MH 270A 15KV 60HZ',   0.202, 75.0,  False),
        ('REATOR TIPO RFF- 125,557MH / 2',  0.303, 100.0, False),  # reator maior, embalagem RT mais larga
        # Chaves a vacuo - CHV001016 (SEC15KV): 1960x1000mm; CHV001011 (CJ15KV): 2720x1200mm
        ('CAT 15KV 630A - NEOENERGIA',      1.960, 108.0, False),  # CHV001016; PESO=108kg@15kV
        ('CAT 36KV 630A',                   3.752, 125.0, False),  # CHV001015 2680x1400mm; PESO=125kg@38kV
        ('CHAVE A VACUO 38KV NBI 170KV',    3.752, 300.0, False),  # CHV001015; PESO=300kg@38kV 200NBI
        ('SAV 36 KV 630 A',                 3.752, 125.0, False),  # CHV001015
        # Estruturas - alias do Leo "CJ ESTRUTURA BANCO SHUNT TRANSENE" para o nome TOTVS
        ('ESTRUTURA BANCO SHUNT TRANSENER', 2.400, 401.0, True),   # mesmo que Leo CJ; empilhavel
        ('ESTRUTURA METALICA NEOENERGIA',   2.400, 200.0, True),   # estimado; estrutura metalica similar
        ('ESTRUTURA METALICA SIMEC ESTAG',  2.400, 200.0, True),
        # Para-raios
        ('PARA-RAIOS 12KVCL2 19134300',     0.040, 15.0,  False),
        ('PARA-RAIOS-36KV10KA-CL2CN',       0.040, 20.0,  False),
        # Isoladores (variantes nao no Leo - base: TR-208 = 0.040m2, 13.25kg)
        ('ISOLADOR SUPORTE MACICO TR-205',  0.040, 11.0,  False),
        ('ISOLADOR SUPORTE MACICO TR-210',  0.040, 15.0,  False),
        ('ISOLADOR SUPORTE MACICO TR-225',  0.040, 21.0,  False),
        ('ISOLADOR SUPORTE MACICO TR-231',  0.040, 25.0,  False),
        # Barramentos (estimados)
        ('BARRAMENTO CHAVE A VACUO',        0.400, 15.0,  False),
        ('BARRAMENTO DE ENTRADA SECCIONA',  0.400, 15.0,  False),
        ('BARRAMENTO ENTRADA',              0.300, 10.0,  False),
        ('BARRAMENTO P/ 02 PORTA-FUS CXP',  0.300, 10.0,  False),
    ]

    conn = get_db()
    cur = conn.cursor()

    # Step 1: fix miscelanea flag
    misc_fixed = 0
    for kw in MISC_KEYWORDS:
        cur.execute(
            "UPDATE products SET miscelanea=TRUE WHERE UPPER(nome) LIKE %s AND miscelanea=FALSE",
            (f'%{kw}%',)
        )
        misc_fixed += cur.rowcount

    # Step 2: next codigo
    cur.execute("SELECT COALESCE(MAX(codigo), 0) FROM products")
    next_cod = cur.fetchone()[0] + 1

    # Step 3: insert missing products (skip if name already exists)
    added, skipped = [], []
    for nome, area, peso, emp in MISSING:
        cur.execute("SELECT 1 FROM products WHERE UPPER(TRIM(nome))=UPPER(TRIM(%s))", (nome,))
        if cur.fetchone():
            skipped.append(nome)
            continue
        cur.execute(
            """INSERT INTO products (codigo, item, nome, area_m2, peso_kg, empilhavel, miscelanea)
               VALUES (%s, %s, %s, %s, %s, %s, FALSE)""",
            (next_cod, nome, nome, area, peso, emp)
        )
        added.append(nome)
        next_cod += 1

    conn.commit()
    conn.close()
    return jsonify({
        'ok': True,
        'miscelanea_fixed': misc_fixed,
        'products_added': len(added),
        'added': added,
        'already_existed': skipped,
    })


@app.route('/api/seed/products', methods=['POST'])
def seed_products():
    """One-time endpoint to populate catalog from historical TOTVS data."""
    conn = get_db()
    cur = conn.cursor()
    inserted = 0
    skipped = 0
    for codigo, nome, misc in _SEED_PRODUCTS:
        cur.execute("SELECT 1 FROM products WHERE codigo=%s", (codigo,))
        if cur.fetchone():
            skipped += 1
            continue
        cur.execute(
            """INSERT INTO products (codigo, item, nome, area_m2, peso_kg, empilhavel, miscelanea)
               VALUES (%s, %s, %s, 0, 0, FALSE, %s)""",
            (codigo, nome, nome, misc)
        )
        inserted += 1
    conn.commit()
    conn.close()
    misc_count = sum(1 for _, _, m in _SEED_PRODUCTS if m)
    return jsonify({
        'ok': True, 'inserted': inserted, 'skipped': skipped,
        'total': len(_SEED_PRODUCTS),
        'miscelanea': misc_count,
        'equipamentos': len(_SEED_PRODUCTS) - misc_count,
    })

# ─── CARGO CALCULATOR ─────────────────────────────────────────────────────────

def obter_dados_produto_db(cur, codigo):
    cur.execute("SELECT * FROM products WHERE codigo = %s", (codigo,))
    produto = cur.fetchone()
    if produto is None:
        return None, None, None, None
    area = float(produto['area_m2'])
    peso = float(produto['peso_kg'])
    empilhavel = bool(produto['empilhavel'])
    nome = produto['nome']
    return area, peso, empilhavel, nome

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.json
    qtd_bancos = int(data.get('qtd_bancos', 0))
    order_ids = data.get('order_ids', [])  # list of sales_order ids to include
    use_all_orders = data.get('use_all_orders', False)

    conn = get_db()
    cur = dict_cursor(conn)

    # Load trucks
    cur.execute("SELECT id_carreta AS id, nome, area_base_m2 FROM trucks ORDER BY id_carreta")
    frotas = cur.fetchall()
    if not frotas:
        conn.close()
        return jsonify({'error': 'Nenhum tipo de veículo cadastrado. Cadastre veículos primeiro.'}), 400

    area_padrao = float(frotas[0]['area_base_m2'])
    contador_extras = 1

    status_frota = []
    for v in frotas:
        status_frota.append({
            "veiculo": v['nome'] or f"Veículo {v['id']}",
            "area_livre": float(v['area_base_m2']),
            "peso_acumulado": 0.0,
            "historico_cargas": []
        })

    area_banco = 1.60 * 0.60
    peso_banco = 500.0
    bancos_restantes = qtd_bancos

    while bancos_restantes > 0:
        conseguiu = False
        for frota in status_frota:
            pode = math.floor(frota["area_livre"] / area_banco)
            qtd = min(bancos_restantes, pode)
            if qtd > 0:
                frota["area_livre"] -= area_banco * qtd
                frota["peso_acumulado"] += peso_banco * qtd
                frota["historico_cargas"].append({
                    "tipo": "banco",
                    "descricao": f"Banco do Pedido (Caixa Miscelânea - 1.6x0.6m)",
                    "quantidade": qtd,
                    "peso": peso_banco * qtd
                })
                bancos_restantes -= qtd
                conseguiu = True
                if bancos_restantes == 0:
                    break
        if bancos_restantes > 0 and not conseguiu:
            status_frota.append({
                "veiculo": f"Carreta Extra {contador_extras}",
                "area_livre": area_padrao,
                "peso_acumulado": 0.0,
                "historico_cargas": []
            })
            contador_extras += 1

    # Load orders
    if use_all_orders:
        cur.execute("SELECT * FROM sales_orders ORDER BY id")
    elif order_ids:
        cur.execute("SELECT * FROM sales_orders WHERE id = ANY(%s) ORDER BY id", (order_ids,))
    else:
        cur.execute("SELECT * FROM sales_orders ORDER BY id")
    orders = cur.fetchall()

    warnings = []

    for order in orders:
        num_venda = order['num_venda']
        cliente = order['cliente']
        produtos = order['produtos']
        if isinstance(produtos, str):
            try:
                produtos = json.loads(produtos)
            except Exception:
                continue

        for cod_str, qtd_total in produtos.items():
            try:
                codigo = int(cod_str)
            except ValueError:
                warnings.append(f"Invalid code '{cod_str}' in order {num_venda}")
                continue

            area_unit, peso_unit, empilhavel, nome_prod = obter_dados_produto_db(cur, codigo)
            if area_unit is None:
                warnings.append(f"Product code {codigo} not found (order {num_venda})")
                continue

            if not empilhavel and area_unit > area_padrao:
                warnings.append(f"'{nome_prod}' exceeds truck floor area — cannot load")
                continue

            qtd_restante = int(qtd_total)
            while qtd_restante > 0:
                conseguiu = False
                for frota in status_frota:
                    if qtd_restante <= 0:
                        break
                    if not empilhavel and area_unit > 0:
                        pode = math.floor(frota["area_livre"] / area_unit)
                    else:
                        pode = qtd_restante
                    qtd = min(qtd_restante, pode)
                    if qtd > 0:
                        if not empilhavel:
                            frota["area_livre"] -= area_unit * qtd
                        frota["peso_acumulado"] += peso_unit * qtd
                        frota["historico_cargas"].append({
                            "tipo": "produto",
                            "num_venda": num_venda,
                            "cliente": cliente,
                            "nome": nome_prod,
                            "quantidade": qtd,
                            "peso": peso_unit * qtd,
                            "empilhavel": empilhavel
                        })
                        qtd_restante -= qtd
                        conseguiu = True
                if qtd_restante > 0 and not conseguiu:
                    status_frota.append({
                        "veiculo": f"Carreta Extra {contador_extras}",
                        "area_livre": area_padrao,
                        "peso_acumulado": 0.0,
                        "historico_cargas": []
                    })
                    contador_extras += 1

    conn.close()

    result_frotas = [f for f in status_frota if f["historico_cargas"]]
    return jsonify({
        "trucks_used": len(result_frotas),
        "trucks": result_frotas,
        "warnings": warnings
    })

# ─── STATS ────────────────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def stats():
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute("SELECT COUNT(*) AS cnt FROM products")
    prod_count = cur.fetchone()['cnt']
    cur.execute("SELECT COUNT(*) AS cnt FROM trucks")
    truck_count = cur.fetchone()['cnt']
    cur.execute("SELECT COUNT(*) AS cnt FROM sales_orders")
    order_count = cur.fetchone()['cnt']
    cur.execute("SELECT COALESCE(SUM(area_base_m2),0) AS total FROM trucks")
    total_area = cur.fetchone()['total']
    conn.close()
    return jsonify({
        "products": prod_count,
        "trucks": truck_count,
        "orders": order_count,
        "total_fleet_area": total_area
    })

# ─── SPA FALLBACK (serves React app for all non-API routes in production) ────

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
    file_path = os.path.join(dist, path)
    if path and os.path.exists(file_path):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
