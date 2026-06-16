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
            empilhavel BOOLEAN DEFAULT FALSE
        );
        CREATE TABLE IF NOT EXISTS trucks (
            id_carreta   SERIAL PRIMARY KEY,
            area_base_m2 FLOAT
        );
        CREATE TABLE IF NOT EXISTS sales_orders (
            id        SERIAL PRIMARY KEY,
            num_venda TEXT,
            cliente   TEXT,
            produtos  JSONB
        );
    """)
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
        """INSERT INTO products (codigo, item, nome, area_m2, peso_kg, empilhavel)
           VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
        (data['codigo'], data['item'], data['nome'],
         data['area_m2'], data['peso_kg'], data['empilhavel'])
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
           peso_kg=%s, empilhavel=%s WHERE codigo=%s RETURNING *""",
        (data['codigo'], data['item'], data['nome'],
         data['area_m2'], data['peso_kg'], data['empilhavel'], pid)
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
    cur.execute("SELECT * FROM trucks ORDER BY id_carreta")
    rows = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/trucks', methods=['POST'])
def create_truck():
    data = request.json
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute(
        "INSERT INTO trucks (id_carreta, area_base_m2) VALUES (%s, %s) RETURNING *",
        (data['id_carreta'], data['area_base_m2'])
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
        "UPDATE trucks SET id_carreta=%s, area_base_m2=%s WHERE id_carreta=%s RETURNING *",
        (data['id_carreta'], data['area_base_m2'], tid)
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
                    """INSERT INTO products (codigo, item, nome, area_m2, peso_kg, empilhavel)
                       VALUES (%s, %s, %s, %s, %s, %s)
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
    # Safety lock for the protected cable
    if codigo == 46 or "CABOPROTEGIDO15KV50MM2" in nome.upper():
        area = 1.2
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
    cur.execute("SELECT * FROM trucks ORDER BY id_carreta")
    frotas = cur.fetchall()
    if not frotas:
        conn.close()
        return jsonify({'error': 'No trucks configured. Add trucks first.'}), 400

    area_padrao = float(frotas[0]['area_base_m2'])
    contador_extras = 1

    status_frota = []
    for v in frotas:
        status_frota.append({
            "veiculo": v['id_carreta'],
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
