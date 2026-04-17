# Gullas – Sistema de Controle de Vendas

Sistema PWA (Progressive Web App) de controle de lanchonete com dois painéis:
- **Painel da Atendente** (`Indexloja.html`) – registrar vendas e sobras do dia
- **Painel do Administrador** (`Indexadm.html`) – gerenciar catálogo, visualizar financeiro e relatórios

---

## ⚙️ Instalação do Backend (Google Apps Script)

> **Este passo é necessário uma única vez.**

1. Abra a sua **planilha Google Sheets** (crie uma planilha nova se ainda não tiver).
2. Menu → **Extensões › Apps Script**.
3. Apague o conteúdo padrão e cole todo o conteúdo do arquivo **`Code.gs`** deste repositório.
4. Salve (`Ctrl+S`) e dê um nome ao projeto (ex.: *Gullas Backend*).
5. Clique em **Implantar › Nova implantação**:
   - Tipo: **Aplicativo da Web**
   - Executar como: **Eu (sua conta Google)**
   - Quem tem acesso: **Qualquer pessoa**
6. Clique em **Implantar** e autorize as permissões solicitadas.
7. **Copie a URL gerada** (formato `https://script.google.com/macros/s/…/exec`).

---

## 🔗 Configurar a URL nos arquivos HTML

Abra `Indexloja.html` e `Indexadm.html` e substitua a linha:

```js
const SCRIPT_URL = "COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT";
```

pela URL copiada no passo anterior.

---

## 🔐 Senha do Administrador

A senha padrão do painel ADM é **`gullas@2026`**.

> ⚠️ **Importante:** troque esta senha imediatamente após a primeira instalação para evitar acesso não autorizado.

Para alterar, edite a linha em `Indexadm.html`:

```js
const SENHA_PADRAO = "gullas@2026";
```

A senha digitada na primeira sessão é armazenada localmente no dispositivo do administrador.

---

## 📱 Funcionalidades

### Painel da Atendente (`Indexloja.html`)
| Funcionalidade | Descrição |
|---|---|
| **Aba Vendas** | Grade de produtos com seleção múltipla; confirmar pedido com quantidades e marcar/desmarcar itens |
| **Aba Sobras** | Inserir quantidades que sobraram no fim do dia por produto |
| **Observação + foto** | Campo de texto e upload de imagem (redimensionada automaticamente) em vendas e sobras |
| **Fechar Caixa (Loja)** | Atendente pode encerrar o caixa do dia pelo próprio painel |
| **Adicionar produto** | Novo item direto pelo painel; salvo no catálogo central automaticamente |
| **Modo offline** | Catálogo em cache; envios aguardam conexão |

### Painel do Administrador (`Indexadm.html`)
| Funcionalidade | Descrição |
|---|---|
| **Catálogo** | Cadastrar, editar e remover produtos com preço unitário |
| **Vendas** | Visualizar vendas por data com quantidade, preço unitário, subtotal e **total faturado** |
| **Sobras** | Visualizar sobras registradas pelas atendentes por data |
| **Estufa** | Controlar quantidades enviadas por data, registrar **envios acumulados ao longo do dia**, acompanhar vendido/disponível em tempo real e gerar sugestão de nova remessa via WhatsApp |
| **Resumo** | KPIs do dia (faturamento, itens vendidos, sobras, observações) + exportação em **PDF** |
| **Fechar Caixa** | Registra encerramento do dia e salva total na planilha |

---

## 🗄️ Estrutura da Planilha

O Apps Script cria as abas automaticamente na primeira execução:

| Aba | Colunas |
|---|---|
| `Catalogo` | id · nome · preco · ativo |
| `Movimentos` | timestamp · data · tipo · produto · qtd · preco_unit · total · funcionario · obs · imagem_url |
| `Envios` | timestamp · data · produto · qtd · funcionario |
| `Fechamentos` | timestamp · data · funcionario · total_venda |

---

## 🌐 Publicar no GitHub Pages

1. Repositório → **Settings › Pages**.
2. Source: **branch `main`**, pasta `/` (root).
3. Acesse os painéis pelos links:
   - `https://<usuario>.github.io/<repo>/Indexloja.html`
   - `https://<usuario>.github.io/<repo>/Indexadm.html`
