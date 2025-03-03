require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;
const SHOPIFY_STORE = "yqqpuw-i1.myshopify.com"; // Substitua com o nome da sua loja
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Use a variável de ambiente
const WEBHOOK_URL = "https://shopify-payments-webhook-production.up.railway.app/webhook/orders_paid"; // URL do seu servidor

// Middleware para processar o corpo da requisição como raw
app.use(bodyParser.raw({ type: "application/json" }));

// Função para verificar a assinatura do Shopify
function verifyShopifySignature(req) {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const body = req.body;
    const generatedHmac = crypto.createHmac("sha256", SHOPIFY_SECRET)
        .update(body, "utf8")
        .digest("base64");

    return hmacHeader === generatedHmac;
}

// Rota para interceptar o Webhook de "orders/paid"
app.post("/webhook/orders_paid", (req, res) => {
    if (!verifyShopifySignature(req)) {
        console.error("❌ Assinatura do webhook inválida!");
        return res.status(400).send("Webhook error: assinatura inválida");
    }

    let payload;
    try {
        payload = JSON.parse(req.body);
        console.log("🔹 Webhook de pagamento recebido:", payload);
    } catch (err) {
        console.error("❌ Erro ao parsear JSON:", err);
        return res.status(400).send("Erro no JSON");
    }

    // ✅ Alterar o nome do produto antes de processar
    const novoNomeProduto = "Edição Especial - " + payload.order.line_items[0].name;

    // 🔄 Responder à Shopify com os dados modificados
    const response = {
        order: {
            id: payload.order.id,
            line_items: payload.order.line_items.map(item => ({
                ...item,
                name: novoNomeProduto // Alterando o nome do produto
            })),
            status: "paid" // Confirmando o pagamento
        }
    };

    console.log("✅ Pedido atualizado antes do pagamento:", response);
    res.json(response);
});

// Função para registrar o webhook
async function registerWebhook() {
    try {
        const response = await axios.post(
            `https://${SHOPIFY_STORE}/admin/api/2023-10/webhooks.json`, // Atualize a versão da API conforme necessário
            {
                webhook: {
                    topic: "orders/paid", // Tópico válido para pedidos pagos
                    address: WEBHOOK_URL,
                    format: "json"
                }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN
                }
            }
        );

        console.log("✅ Webhook registrado com sucesso:", response.data);
    } catch (error) {
        console.error("❌ Erro ao registrar webhook:", error.response ? error.response.data : error.message);
    }
}

// Chama a função para registrar o webhook ao iniciar o servidor
registerWebhook();

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
