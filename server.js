require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;

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

// Rota para interceptar o Webhook da Shopify Payments
app.post("/shopify-payment-webhook", (req, res) => {
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

    // ✅ Alterar o nome do produto antes da Shopify processar
    const novoNomeProduto = "Edição Especial - " + payload.paymentSession.line_items[0].name;

    // 🔄 Responder à Shopify com os dados modificados
    const response = {
        payment_session: {
            id: payload.paymentSession.id,
            line_items: payload.paymentSession.line_items.map(item => ({
                ...item,
                name: novoNomeProduto // Alterando o nome do produto
            })),
            status: "resolved" // Confirmando o pagamento
        }
    };

    console.log("✅ Pedido atualizado antes do pagamento:", response);
    res.json(response);
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
