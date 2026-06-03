import pandas as pd
import ast
import math

# 1. Configuração dos ficheiros
arquivo_produtos = 'produtos.xlsx'
arquivo_frotas = 'frotas.xlsx'
arquivo_vendas = 'Vendas.xlsx' 

def carregar_dados():
    try:
        # Carrega Produtos e ajusta nome da coluna de Área
        df_p = pd.read_excel(arquivo_produtos, sheet_name='Resultados')
        df_p.rename(columns={'Area (mm²)': 'Area (m²)'}, inplace=True)
        
        # Carrega Frotas e Vendas
        df_f = pd.read_excel(arquivo_frotas, sheet_name='Planilha1') 
        df_v = pd.read_excel(arquivo_vendas, sheet_name='Planilha1')
        
        print("✅ Planilhas carregadas com sucesso!\n")
        return df_p, df_f, df_v
    except Exception as e:
        print(f"❌ Erro ao carregar ficheiros. Detalhe: {e}")
        return None, None, None

df_produtos, df_frotas, df_vendas = carregar_dados()

def obter_dados_produto(codigo_procurado):
    if df_produtos is None: return None, None, None, None
    
    # 🎯 CORREÇÃO: Localiza o produto pelo CÓDIGO informado no dicionário de vendas
    produto = df_produtos[df_produtos['Código'] == int(codigo_procurado)]
    if produto.empty: return None, None, None, None

    item_original = str(produto.iloc[0]['Item'])
    
    # 🎯 ADAPTAÇÃO: Extrai o nome real do produto que está APÓS o "-"
    if '-' in item_original:
        nome_produto = item_original.split('-', 1)[1].strip()
    else:
        nome_produto = item_original.strip()

    area = float(produto.iloc[0]['Area (m²)']) 
    peso = float(produto.iloc[0]['Peso (kg)']) if 'Peso (kg)' in produto.columns else 0.0
    empilhavel = str(produto.iloc[0]['Empilhável (s/n)']).strip().lower() == 'sim'
    
    # Trava de segurança histórica para o cabo pelo código ou nome
    if int(codigo_procurado) == 46 or "CABOPROTEGIDO15KV50MM2" in nome_produto.upper():
        area = 1.2
    
    return area, peso, empilhavel, nome_produto

def processar_alocacao_completa():
    if any(df is None for df in [df_produtos, df_frotas, df_vendas]):
         return "Erro: Planilhas não disponíveis."

    # Solicita a quantidade de bancos ao usuário
    try:
        qtd_bancos = int(input("Digite a quantidade de bancos do pedido: "))
    except ValueError:
        print("⚠️ Quantidade inválida inserida. Assumindo 0 bancos.")
        qtd_bancos = 0

    # Dimensões e especificações fixas do Banco (caixa de miscelânea)
    area_banco = 1.60 * 0.60  # 0.96 m²
    peso_banco = 500.0        # 500 kg fixos
    
    area_padrao = float(df_frotas.iloc[0]['Area Base (m²)'])
    contador_extras = 1 

    # Inicializa a frota principal (Controlando Área e Peso acumulado)
    status_frota = []
    for _, veiculo in df_frotas.iterrows():
        status_frota.append({
            "veiculo": veiculo['ID Carreta'],
            "area_livre": float(veiculo['Area Base (m²)']), 
            "peso_acumulado": 0.0,
            "historico_cargas": [] 
        })

    print("=" * 80)
    print("🚚 INICIANDO CARREGAMENTO (FOCO EM ÁREA DE PISO & PESO DOS BANCOS) 🚚")
    print("=" * 80)

    # ALOCAÇÃO DOS BANCOS (Inseridos prioritariamente no carregamento)
    bancos_restantes = qtd_bancos
    while bancos_restantes > 0:
        conseguiu_alocar_banco = False
        
        for frota in status_frota:
            pode_levar_area = math.floor(frota["area_livre"] / area_banco)
            qtd_a_carregar = min(bancos_restantes, pode_levar_area)
            
            if qtd_a_carregar > 0:
                frota["area_livre"] -= (area_banco * qtd_a_carregar)
                frota["peso_acumulado"] += (peso_banco * qtd_a_carregar)
                frota["historico_cargas"].append(
                    f"🗃️ Banco do Pedido (Caixa Miscelânea - 1.6x0.6m): {qtd_a_carregar} un ({peso_banco * qtd_a_carregar:.1f} kg)"
                )
                bancos_restantes -= qtd_a_carregar
                conseguiu_alocar_banco = True
                if bancos_restantes == 0: break
                
        if bancos_restantes > 0 and not conseguiu_alocar_banco:
            status_frota.append({
                "veiculo": f"Carreta Extra {contador_extras}",
                "area_livre": area_padrao,
                "peso_acumulado": 0.0,
                "historico_cargas": []
            })
            contador_extras += 1

    # Loop principal: Iterando sobre as Vendas
    for index, row in df_vendas.iterrows():
        num_venda = row['N° da Venda']
        cliente = row['Cliente']
        produtos_texto = row['Produtos']

        if pd.isna(produtos_texto): continue

        try:
            pedido = ast.literal_eval(produtos_texto)
        except (ValueError, SyntaxError):
            print(f"⚠️ Erro ao ler os produtos da Venda {num_venda}.")
            continue

        # Processa cada item utilizando a chave (Código em string) para buscar as propriedades
        for cod_str, qtd_total in pedido.items():
            try:
                codigo = int(cod_str)
            except ValueError:
                print(f"⚠️ Código inválido '{cod_str}' encontrado na Venda {num_venda}. Ignorando...")
                continue

            area_unit, peso_unit, empilhavel, nome_prod = obter_dados_produto(codigo)
            
            if area_unit is None:
                print(f"⚠️ Produto com Código '{codigo}' não encontrado nas planilhas. Ignorando...")
                continue

            # Trava de segurança baseada apenas em área se for não-empilhável
            if not empilhavel and area_unit > area_padrao:
                print(f"❌ O item '{nome_prod}' supera a área útil do piso da carreta. Impossível carregar.")
                continue

            qtd_restante = qtd_total
            
            while qtd_restante > 0:
                conseguiu_alocar_algo = False

                for frota in status_frota:
                    if qtd_restante <= 0: break

                    # Restrição de área aplicada APENAS se NÃO for empilhável
                    if not empilhavel and area_unit > 0:
                        pode_levar = math.floor(frota["area_livre"] / area_unit)
                    else:
                        pode_levar = qtd_restante  # Se for empilhável, passa direto sem ocupar o chão

                    qtd_a_carregar = min(qtd_restante, pode_levar)

                    if qtd_a_carregar > 0:
                        if not empilhavel:
                            frota["area_livre"] -= (area_unit * qtd_a_carregar)
                        
                        # Acumula o peso do item carregado
                        frota["peso_acumulado"] += (peso_unit * qtd_a_carregar)
                        
                        # O registro agora usa exclusivamente o NOME limpo do produto
                        registo = f"📦 Venda {num_venda} ({cliente}) - {nome_prod}: {qtd_a_carregar} un ({peso_unit * qtd_a_carregar:.1f} kg)"
                        frota["historico_cargas"].append(registo)
                        
                        qtd_restante -= qtd_a_carregar
                        conseguiu_alocar_algo = True

                if qtd_restante > 0 and not conseguiu_alocar_algo:
                    status_frota.append({
                        "veiculo": f"Carreta Extra {contador_extras}",
                        "area_livre": area_padrao,
                        "peso_acumulado": 0.0,
                        "historico_cargas": []
                    })
                    contador_extras += 1

    # RESUMO FINAL
    print("\n" + "=" * 80)
    print(f"📊 RESUMO DO CARREGAMENTO FINAL ({len(status_frota)} VEÍCULOS UTILIZADOS):")
    print("=" * 80)
    for frota in status_frota:
        if not frota["historico_cargas"]:
            continue
            
        print(f"Subtotal 🚛 {frota['veiculo']}:")
        for carga in frota["historico_cargas"]:
            print(f"   {carga}")
        print(f"   📐 Área de Piso Restante: {frota['area_livre']:.2f} m² | ⚖️ Peso Total na Carreta: {frota['peso_acumulado']:.2f} kg")
        print("-" * 60)

# Executar o processo completo
processar_alocacao_completa()