/****************************************************
 * FOOD GUARD
 ****************************************************/

// Controle da câmera
let html5QrCode;
let isScanning = false;

/* -----------------------------------------------
   📌 FUNÇÕES DA SIDEBAR
--------------------------------------------------*/
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showRestrictions() {
    const box = document.getElementById("scannerBox");
    window.scrollTo({ top: box.offsetTop - 50, behavior: "smooth" });
}

function openMapsSearch() {
    window.open(
        "https://www.google.com/maps/search/restaurantes+com+opções+sem+restrições+perto+de+mim",
        "_blank"
    );
}

/* -----------------------------------------------
   📸 ATIVAÇÃO E DESATIVAÇÃO DA CÂMERA
--------------------------------------------------*/
async function toggleCamera() {
    const btn = document.getElementById("cam-btn");
    const readerDiv = document.getElementById("reader");

    if (isScanning) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.error("Erro ao parar câmera:", err);
        }
        readerDiv.classList.add("escondido");
        btn.innerText = "📷 Ativar Câmera";
        btn.classList.remove("active");
        isScanning = false;
        return;
    }

    readerDiv.classList.remove("escondido");
    btn.innerText = "⏳ Iniciando...";

    if (typeof Html5Qrcode === "undefined") {
        alert("Biblioteca Html5Qrcode não carregada.");
        readerDiv.classList.add("escondido");
        btn.innerText = "📷 Ativar Câmera";
        return;
    }

    html5QrCode = new Html5Qrcode("reader");

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            onScanSuccess
        );
        btn.innerText = "⏹ Parar Câmera";
        btn.classList.add("active");
        isScanning = true;
    } catch (err) {
        alert("Erro ao abrir câmera. Use HTTPS ou localhost.");
        console.error(err);
        readerDiv.classList.add("escondido");
        btn.innerText = "📷 Ativar Câmera";
    }
}

function onScanSuccess(decodedText) {
    document.getElementById("manual-code").value = decodedText;
    fetchProductData(decodedText);
    toggleCamera(); // Desliga após leitura
}

/* -----------------------------------------------
   📥 BUSCA MANUAL
--------------------------------------------------*/
function manualSearch() {
    const code = document.getElementById("manual-code").value.trim();
    if (code.length < 3) {
        alert("Digite um código de barras válido.");
        return;
    }
    fetchProductData(code);
}

/* -----------------------------------------------
   🌐 CONSULTA À API DO OPEN FOOD FACTS
--------------------------------------------------*/
async function fetchProductData(barcode) {
    const resultDiv = document.getElementById("result-section");
    const nameDiv = document.getElementById("product-name");

    const selectedAllergies = [...document.querySelectorAll('input[name="allergy"]:checked')]
        .map(cb => cb.value);

    if (selectedAllergies.length === 0) {
        alert("⚠ Selecione ao menos uma restrição alimentar.");
        return;
    }

    resultDiv.classList.remove("escondido");
    nameDiv.innerText = "";
    document.getElementById("mensagem").innerText = "🔄 Analisando ingredientes...";
    document.getElementById("iconeAvaliacao").src = "";
    document.getElementById("suggestions").classList.add("escondido");

    try {
        const response = await fetch(
            `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.status === 1) {
            const product = data.product;
            nameDiv.innerText = product.product_name || `Produto: ${barcode}`;
            checkIngredients(product, selectedAllergies);
        } else {
            showProductNotFound();
        }
    } catch (err) {
        showNetworkError();
        console.error(err);
    }    
}

/* -----------------------------------------------
   ❌ ERRO: PRODUTO NÃO ENCONTRADO
--------------------------------------------------*/
function showProductNotFound() {
    document.getElementById("mensagem").innerText =
        "❌ Produto não encontrado na base de dados.";
    document.getElementById("iconeAvaliacao").src = "img/nao_recomendado.jpg";
    document.getElementById("result").className = "result-box unsafe";
}

/* -----------------------------------------------
   ❌ ERRO DE CONEXÃO
--------------------------------------------------*/
function showNetworkError() {
    document.getElementById("mensagem").innerText =
        "⚠ Erro ao conectar ao servidor. Verifique sua internet.";
    document.getElementById("iconeAvaliacao").src = "img/nao_recomendado.jpg";
    document.getElementById("result").className = "result-box unsafe";
}

/* -----------------------------------------------
   🔎 SUGESTÕES DE SUBSTITUIÇÃO (MAPS)
--------------------------------------------------*/
const specificProducts = {
    milk: "manteiga vegetal",
    gluten: "pão sem glúten",
    sugar: "doce zero açúcar",
    soy: "leite vegetal",
    egg: "maionese vegana",
    seafood: "alternativa vegana de frutos do mar",
    peanut: "produtos sem amendoim",
    nuts: "produtos sem nozes",


};

/* -----------------------------------------------
   🧪 ANÁLISE COMPLETA DE INGREDIENTES
--------------------------------------------------*/
function checkIngredients(product, selectedAllergies) {
    const ingredients =
        (
            product.ingredients_text_pt ||
            product.ingredients_text_br ||
            product.ingredients_text ||
            ""
        ).toLowerCase();

    const allergenTags = (product.allergens_tags || [])
        .join(" ")
        .toLowerCase();

    // Se não há informações suficientes
    if (!ingredients || ingredients.length < 3) {
        showInsufficientData();
        return;
    }

    const keywords = {
        gluten: ["trigo", "farinha de trigo", "cevada", "centeio", "malte", "espelta", "kamut", "wheat", "wheat flour", "barley", "rye", "malt", "spelt", "kamut", "triticale"],
        milk: ["leite", "queijo", "soro de leite", "caseina", "caseinato", "whey", "creme de leite", "milk", "cheese", "casein", "caseinate", "cream"],
        sugar: ["açúcar", "acucar", "glicose", "xarope", "frutose", "maltose", "sacarose", "mel", "sugar", "glucose", "syrup", "fructose", "maltose", "sucrose", "honey"],
        seafood: ["camarão", "peixe", "siri", "marisco", "ostra", "atum", "bacalhau", "tilapia", "anchova", "crustaceans", "shrimp", "fish", "crab", "shellfish", "oyster", "tuna", "cod", "tilapia", "anchovy", "lagosta", "lobster"],
        egg: ["ovo", "gema", "clara", "albumina", "ovalbumina"],
        soy: ["soja", "soy", "isolado de soja", "proteína de soja", "farinha de soja", "soy isolate", "soy protein", "soy flour", "soybeans"],
        peanut: ["amendoim", "peanut", "peanuts"],
        nuts: ["nut", "nuts", "noz", "nozes", "castanha", "nozes", "avelã", "amêndoa", "macadâmia", "pistache", "chestnut", "walnuts", "hazelnut", "almond", "macadamia", "pistachio"],
        mustard: ["mustard", "mostarda"],

    };

    let detectedRisks = [];

    // Verificação principal
    selectedAllergies.forEach(allergy => {
        const allergyLower = allergy.toLowerCase();
        let found = false;

        // Verifica allergens_tags oficiais
        if (allergenTags.includes(`:${allergyLower}`)) found = true;

        // Verificação com regex
        if (keywords[allergyLower]) {
            keywords[allergyLower].forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, "i");
                if (regex.test(ingredients)) found = true;
            });
        }

        if (found) detectedRisks.push(allergy.toUpperCase());
    });

    detectedRisks.length > 0
        ? showUnsafeResult(detectedRisks)
        : showSafeResult();
}

/* -----------------------------------------------
   ❌ RESULTADO NÃO RECOMENDADO
--------------------------------------------------*/
function showUnsafeResult(detected) {
    const result = document.getElementById("result");
    const mensagem = document.getElementById("mensagem");
    const icone = document.getElementById("iconeAvaliacao");
    const suggestionsDiv = document.getElementById("suggestions");

    mensagem.innerHTML = `NÃO RECOMENDADO<br><span style="font-size:0.8em;">Pode conter: <strong>${detected.join(", ")}</strong></span>`;
    mensagem.style.color = "#cc4444";
    icone.src = "img/nao_recomendado.jpg";
    result.className = "result-box unsafe";

    const firstRisk = detected[0].toLowerCase();
    const suggestion = specificProducts[firstRisk] || `produtos sem ${firstRisk}`;

    suggestionsDiv.classList.remove("escondido");
    suggestionsDiv.innerHTML = `
        <h4>✨ Alternativas próximas:</h4>
        <p style="font-size:0.9em;">Sugestão: procure por <strong>${suggestion}</strong>.</p>
        <a class="maps-link"
           target="_blank"
           href="https://www.google.com/maps/search/${suggestion}+perto+de+mim">
           🗺️ Ver no mapa
        </a>
    `;
}

/* -----------------------------------------------
   ✅ RESULTADO SEGURO
--------------------------------------------------*/
function showSafeResult() {
    const result = document.getElementById("result");
    const mensagem = document.getElementById("mensagem");
    const icone = document.getElementById("iconeAvaliacao");

    mensagem.innerText = "RECOMENDADO";
    mensagem.style.color = "#1f4d2c";
    icone.src = "img/recomendado.jpg";
    result.className = "result-box safe";
}

/* -----------------------------------------------
   ⚠ DADOS INSUFICIENTES
--------------------------------------------------*/
function showInsufficientData() {
    const result = document.getElementById("result");
    const mensagem = document.getElementById("mensagem");
    const icone = document.getElementById("iconeAvaliacao");

    mensagem.innerHTML = `⚠ NÃO É POSSÍVEL AVALIAR<br><span style="font-size:0.8em;">O produto não possui informações suficientes.</span>`;
    mensagem.style.color = "#cc4444";
    icone.src = "img/nao_recomendado.jpg";
    result.className = "result-box unsafe";
}

/* -----------------------------------------------
   🟢 SPLASH SCREEN
--------------------------------------------------*/
window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("splash").style.display = "none";
    }, 3000);
});

/* -----------------------------------------------
   ❓ SISTEMA DE AJUDA (MODAL)
--------------------------------------------------*/
function openHelp() {
    const modal = document.getElementById("helpModal");
    modal.classList.remove("escondido");
}

function closeHelp(event) {
    // Fecha se clicar no botão X, no botão "Entendi" ou fora da caixa branca
    if (event.target.id === "helpModal" || 
        event.target.className === "close-btn" || 
        event.target.innerText === "Entendi!") {
        
        document.getElementById("helpModal").classList.add("escondido");
    }
}

// Fecha o modal se o usuário apertar a tecla ESC
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        document.getElementById("helpModal").classList.add("escondido");
    }
});
