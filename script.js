/****************************************************
 * FOOD GUARD - Lógica de Saúde
 ****************************************************/

// Controle da câmera
let html5QrCode;
let isScanning = false;

/* --- 1. CONFIGURAÇÕES DE SAÚDE --- */

// TRADUTOR: Doença -> Ingredientes a evitar
const conditionMap = {
    diabetes: ['sugar'],          // Diabéticos evitam açúcar
    hypertension: ['sodium'],     // Hipertensos evitam sal/sódio
    celiac: ['gluten'],           // Celíacos evitam glúten
    lactose: ['milk'],            // Intolerantes evitam leite
    egg_allergy: ['egg', 'eggs', 'ovo', 'ovos', 'gema', 'clara', 'albumina', 'ovalbumina'],
    peanut_allergy: ['peanut'],
    seafood_allergy: ['seafood'],
    nuts_allergy: ['nuts'],
    soy_allergy: ['soy', 'soybeans'],
    mustard_allergy: ['mustard'],
};

// PALAVRAS-CHAVE para buscar nos rótulos
const keywords = {
    gluten: ["trigo", "farinha de trigo", "cevada", "centeio", "malte", "espelta", "wheat", "barley", "rye", "malt", "gluten", "en:gluten"],
    milk: ["leite", "queijo", "soro de leite", "caseina", "whey", "creme de leite", "milk", "cheese", "cream", "lactose", "dairy", "en:milk"],
    sugar: ["açúcar", "glicose", "xarope", "frutose", "maltose", "sacarose", "mel", "sugar", "glucose", "syrup", "fructose", "sucrose", "honey", "dextrose", "maltodextrina"],
    sodium: ["sal", "sódio", "cloreto de sódio", "bicarbonato de sódio", "glutamato monossódico", "salt", "sodium", "monosodium"],
    seafood: ["camarão", "peixe", "siri", "marisco", "ostra", "atum", "tilapia", "shrimp", "fish", "crab", "shellfish", "crustaceans", "molluscs"],
    egg: ["ovo", "ovos", "gema", "clara", "albumina", "egg", "eggs"],
    peanut: ["amendoim", "peanut", "peanuts"],
    nuts: ["nut", "nuts", "noz", "nozes", "castanha", "avelã", "amêndoa", "macadâmia", "pistache", "chestnut", "walnuts", "hazelnut", "almond", "macadamia", "pistachio", "cashew"],
    soy: ["soja", "soy", "isolado de soja", "proteína de soja", "farinha de soja", "soy isolate", "soy protein", "soy flour", "soybeans"],
    mustard: ["mustard", "mostarda"],
};

// SUGESTÕES DE SUBSTITUIÇÃO
const specificProducts = {
    milk: "leite vegetal ou zero lactose",
    gluten: "alimentos sem glúten (arroz, milho)",
    sugar: "produtos diet/zero açúcar",
    sodium: "temperos naturais sem sal",
    meat: "proteína de soja ou grão de bico",
    egg: "substitutos para ovo",
    peanut: "outras castanhas ou sementes",
    nuts: "substitutos para nozes",
    soy: "substitutos para soja",
    mustard: "substitutos para mostarda",
};

/* --- 2. FUNÇÕES DA INTERFACE --- */

function scrollToTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }
function showRestrictions() { 
    const box = document.getElementById("scannerBox");
    window.scrollTo({ top: box.offsetTop - 50, behavior: "smooth" }); 
}
function openMapsSearch() { window.open("https://www.google.com/maps/search/restaurantes+com+opções+sem+restrições+perto+de+mim", "_blank"); }
function openHelp() { document.getElementById("helpModal").classList.remove("escondido"); }
function closeHelp(e) {
    if(e.target.id === "helpModal" || e.target.className === "close-btn" || e.target.innerText === "Entendi!") {
        document.getElementById("helpModal").classList.add("escondido");
    }
}

/* --- 3. CÂMERA --- */

async function toggleCamera() {
    const btn = document.getElementById("cam-btn");
    const readerDiv = document.getElementById("reader");

    if (isScanning) {
        try { await html5QrCode.stop(); html5QrCode.clear(); } catch (err) {}
        readerDiv.classList.add("escondido");
        btn.innerText = "📷 Ativar Câmera";
        btn.classList.remove("active");
        isScanning = false;
        return;
    }

    readerDiv.classList.remove("escondido");
    btn.innerText = "⏳ Iniciando...";

    if (typeof Html5Qrcode === "undefined") { alert("Erro: Biblioteca não carregada"); return; }
    html5QrCode = new Html5Qrcode("reader");

    try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } }, onScanSuccess);
        btn.innerText = "⏹ Parar Câmera";
        btn.classList.add("active");
        isScanning = true;
    } catch (err) {
        alert("Erro na câmera. Use HTTPS.");
        readerDiv.classList.add("escondido");
        btn.innerText = "📷 Ativar Câmera";
    }
}

function onScanSuccess(decodedText) {
    document.getElementById("manual-code").value = decodedText;
    fetchProductData(decodedText);
    toggleCamera(); 
}

function manualSearch() {
    const code = document.getElementById("manual-code").value.trim();
    if (code.length < 3) return alert("Código inválido");
    fetchProductData(code);
}

/* --- 4. LÓGICA PRINCIPAL (API + FILTRAGEM) --- */

async function fetchProductData(barcode) {
    const resultDiv = document.getElementById("result-section");
    const nameDiv = document.getElementById("product-name");
    const msg = document.getElementById("mensagem");

    // 1. Identificar Condições Selecionadas
    const selectedConditions = [...document.querySelectorAll('input[name="health_condition"]:checked')]
        .map(cb => cb.value);

    if (selectedConditions.length === 0) {
        alert("⚠ Selecione pelo menos uma condição de saúde ou dieta.");
        return;
    }

    // 2. Traduzir Condições para Ingredientes (A MÁGICA ACONTECE AQUI)
    let ingredientsToAvoid = [];
    selectedConditions.forEach(condition => {
        if (conditionMap[condition]) {
            ingredientsToAvoid.push(...conditionMap[condition]);
        }
    });
    // Remove duplicatas
    ingredientsToAvoid = [...new Set(ingredientsToAvoid)];

    // Resetar UI
    resultDiv.classList.remove("escondido");
    nameDiv.innerText = "";
    msg.innerText = "🔄 Analisando tabela nutricional...";
    document.getElementById("iconeAvaliacao").src = "";
    document.getElementById("suggestions").classList.add("escondido");
    document.getElementById("result").className = "result-box";

    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        if (!response.ok) throw new Error("Erro API");
        const data = await response.json();

        if (data.status === 1) {
            const product = data.product;
            nameDiv.innerText = product.product_name || `Código: ${barcode}`;
            checkIngredients(product, ingredientsToAvoid);
        } else {
            showProductNotFound();
        }
    } catch (err) {
        showNetworkError();
    }    
}

function checkIngredients(product, badIngredients) {
    // 1. Preparar Texto dos Ingredientes (Método Antigo)
    const ingredientsText = (
        product.ingredients_text_pt || 
        product.ingredients_text || 
        ""
    ).toLowerCase();

    // 2. Preparar Tags da API (Novo Método - Banco de Dados)
    // O API retorna algo como ["en:milk", "pt:trigo"]. Vamos limpar para ["milk", "trigo"]
    // Combina Alérgenos confirmados + Traços (Pode conter)
const apiAllergens = [...(product.allergens_tags || []), ...(product.traces_tags || [])]
.map(tag => tag.replace(/en:|pt:|fr:/g, "").toLowerCase());

    // Se não tiver info em lugar nenhum, avisa (mas tenta validar o que tiver)
    if (ingredientsText.length < 3 && apiAllergens.length === 0) {
        showInsufficientData();
        return;
    }

    let detectedRisks = [];

    // Verificar cada ingrediente "proibido" selecionado pelo usuário
    badIngredients.forEach(riskItem => {
        const riskLower = riskItem.toLowerCase();
        let found = false;

        // SE TIVER PALAVRAS-CHAVE REGISTRADAS PARA ESSE RISCO
        if (keywords[riskLower]) {
            keywords[riskLower].forEach(word => {
                const wordClean = word.toLowerCase();

                // A) Verifica no TEXTO corrido de ingredientes
                if (ingredientsText.includes(wordClean)) {
                    found = true;
                    // Console log para depuração (opcional)
                    console.log(`Perigo encontrado no texto: ${wordClean}`);
                }

                // B) Verifica nas TAGS da API (Banco de Dados)
                // Verifica se alguma tag da API contém a palavra chave
                if (apiAllergens.some(tag => tag.includes(wordClean))) {
                    found = true;
                    console.log(`Perigo encontrado na API: ${wordClean} (Tag: ${apiAllergens})`);
                }
            });
        }

        if (found) detectedRisks.push(riskItem.toUpperCase());
    });

    // Remover duplicatas nos resultados encontrados
    detectedRisks = [...new Set(detectedRisks)];

    if (detectedRisks.length > 0) {
        showUnsafeResult(detectedRisks);
    } else {
        showSafeResult();
    }
}

/* --- 5. EXIBIÇÃO DE RESULTADOS --- */

function showUnsafeResult(detected) {
    const result = document.getElementById("result");
    const mensagem = document.getElementById("mensagem");
    const icone = document.getElementById("iconeAvaliacao");
    const suggestionsDiv = document.getElementById("suggestions");

    // Traduzir termos técnicos para português na exibição
    const translationDisplay = {
        'SUGAR': 'AÇÚCAR', 'SODIUM': 'SÓDIO/SAL', 'GLUTEN': 'GLÚTEN', 
        'MILK': 'LEITE', 'EGG': 'OVO', 'PEANUT': 'AMENDOIM', 'NUTS': 'NOZES', 'SOY': 'SOJA', 'MUSTARD': 'MOSTARDA', 'SEAFOOD': 'FRUTOS DO MAR',
    };
    
    const displayNames = detected.map(d => translationDisplay[d] || d).join(", ");

    mensagem.innerHTML = `⚠️ ATENÇÃO<br><span style="font-size:0.7em; font-weight:normal">Contém ingredientes de risco para você:</span><br><strong>${displayNames}</strong>`;
    mensagem.style.color = "#cc4444";
    icone.src = "img/nao_recomendado.jpg";
    result.className = "result-box unsafe";

    // Sugestão baseada no primeiro risco encontrado
    const mainRisk = detected[0].toLowerCase();
    const suggestionText = specificProducts[mainRisk] || "produtos alternativos";

    suggestionsDiv.classList.remove("escondido");
    suggestionsDiv.innerHTML = `
        <h4>💡 Alternativa:</h4>
        <p>Procure por <strong>${suggestionText}</strong>.</p>
        <a class="maps-link" target="_blank" href="https://www.google.com/maps/search/${suggestionText}+perto+de+mim">
           🗺️ Encontrar lojas próximas
        </a>
    `;
}

function showSafeResult() {
    const result = document.getElementById("result");
    const mensagem = document.getElementById("mensagem");
    const icone = document.getElementById("iconeAvaliacao");

    mensagem.innerText = "✅ PARECE SEGURO";
    mensagem.style.color = "#1f4d2c";
    icone.src = "img/recomendado.jpg";
    result.className = "result-box safe";
}

function showProductNotFound() {
    document.getElementById("mensagem").innerText = "❌ Produto não cadastrado.";
    document.getElementById("iconeAvaliacao").src = "img/nao_recomendado.jpg";
    document.getElementById("result").className = "result-box unsafe";
}

function showNetworkError() {
    document.getElementById("mensagem").innerText = "📶 Sem conexão.";
}

function showInsufficientData() {
    document.getElementById("mensagem").innerText = "❓ Sem dados de ingredientes.";
    document.getElementById("result").className = "result-box unsafe";
}

// Splash Screen
window.addEventListener("load", () => {
    setTimeout(() => { document.getElementById("splash").style.display = "none"; }, 2500);
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
