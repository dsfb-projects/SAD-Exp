import os
import math
import json
import ast
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import pandas as pd

app = Flask(__name__)
CORS(app)

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

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
           peso_kg=%s, empilhavel=%s WHERE id=%s RETURNING *""",
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
    cur.execute("DELETE FROM products WHERE id=%s", (pid,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# ─── TRUCKS ──────────────────────────────────────────────────────────────────

@app.route('/api/trucks', methods=['GET'])
def list_trucks():
    conn = get_db()
    cur = dict_cursor(conn)
    cur.execute("SELECT * FROM trucks ORDER BY id")
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
        "UPDATE trucks SET id_carreta=%s, area_base_m2=%s WHERE id=%s RETURNING *",
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
    cur.execute("DELETE FROM trucks WHERE id=%s", (tid,))
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

@app.route('/api/import/products', methods=['POST'])
def import_products_excel():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    try:
        df = pd.read_excel(io.BytesIO(f.read()), sheet_name=0)
        df.columns = [str(c).strip() for c in df.columns]

        # Normalise column names to handle variations
        rename_map = {}
        for col in df.columns:
            lc = col.lower()
            if 'código' in lc or 'codigo' in lc:
                rename_map[col] = 'Código'
            elif 'item' in lc or 'produto' in lc:
                rename_map[col] = 'Item'
            elif 'area' in lc or 'área' in lc:
                rename_map[col] = 'Area (m²)'
            elif 'peso' in lc:
                rename_map[col] = 'Peso (kg)'
            elif 'empilh' in lc:
                rename_map[col] = 'Empilhável (s/n)'
        df.rename(columns=rename_map, inplace=True)

        required = ['Código', 'Item', 'Area (m²)', 'Peso (kg)', 'Empilhável (s/n)']
        missing = [c for c in required if c not in df.columns]
        if missing:
            return jsonify({'error': f'Missing columns: {missing}. Found: {list(df.columns)}'}), 400

        conn = get_db()
        cur = conn.cursor()
        inserted = 0
        updated = 0
        errors = []
        for _, row in df.iterrows():
            try:
                codigo = int(row['Código'])
                item = str(row['Item']).strip()
                nome = item.split('-', 1)[1].strip() if '-' in item else item
                area = float(row['Area (m²)'])
                peso = float(row['Peso (kg)'])
                emp = str(row['Empilhável (s/n)']).strip().lower() in ('sim', 'yes', 's', 'true', '1')
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
                errors.append(str(e))
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
    cur.execute("SELECT * FROM trucks ORDER BY id")
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
