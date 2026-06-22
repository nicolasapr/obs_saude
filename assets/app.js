/**
 * app.js — Dashboard estatico: mapas coropleticos PNAES + SISVAN por UF (Leaflet)
 * + Series Temporais (Plotly.js).
 *
 * Carrega manifest.json, monta controles (faixa/ano/habito) a partir do manifest,
 * busca GeoJSON de estados e dados agregados por UF, e pinta dois mapas lado a lado.
 * Issue 03: drill-down municipal — clique em UF carrega geo+valores municipais.
 * Issue 04: aba Series Temporais com graficos de linha mensais (Plotly.js).
 */

const DATA_BASE = "data/";

// ── UF code → state name lookup ─────────────────────────────────────────
const UF_NOMES = {
  AC:"Acre",AL:"Alagoas",AM:"Amazonas",AP:"Amapa",BA:"Bahia",CE:"Ceara",
  DF:"Distrito Federal",ES:"Espirito Santo",GO:"Goias",MA:"Maranhao",
  MG:"Minas Gerais",MS:"Mato Grosso do Sul",MT:"Mato Grosso",PA:"Para",
  PB:"Paraiba",PE:"Pernambuco",PI:"Piaui",PR:"Parana",RJ:"Rio de Janeiro",
  RN:"Rio Grande do Norte",RO:"Rondonia",RR:"Roraima",RS:"Rio Grande do Sul",
  SC:"Santa Catarina",SE:"Sergipe",SP:"Sao Paulo",TO:"Tocantins"
};

// ── UF code (2-digit) → sigla ───────────────────────────────────────────
const UFCOD_TO_SIGLA = {
  "11":"RO","12":"AC","13":"AM","14":"RR","15":"PA","16":"AP","17":"TO",
  "21":"MA","22":"PI","23":"CE","24":"RN","25":"PB","26":"PE","27":"AL","28":"SE","29":"BA",
  "31":"MG","32":"ES","33":"RJ","35":"SP",
  "41":"PR","42":"SC","43":"RS",
  "50":"MS","51":"MT","52":"GO","53":"DF"
};

// ── Estado global ────────────────────────────────────────────────────────
let manifest = null;
let estadosGeo = null;

// Per-map state
const mapState = {
  pnaes: { map: null, geoLayer: null, infoCtrl: null, dados: null, drillUF: null },
  sisvan: { map: null, geoLayer: null, infoCtrl: null, dados: null, drillUF: null },
};

// ── Escala de cores YlOrRd (6 faixas) ───────────────────────────────────
const CORES = ["#ffffb2", "#fed976", "#feb24c", "#fd8d3c", "#f03b20", "#bd0026"];
const COR_SEM_DADO = "lightgray";

function corPorValor(valor, min, max) {
  if (valor == null || isNaN(valor)) return COR_SEM_DADO;
  const range = max - min;
  if (range <= 0) return CORES[0];
  const t = (valor - min) / range;
  const idx = Math.min(Math.floor(t * CORES.length), CORES.length - 1);
  return CORES[idx];
}

// ── Formatters ──────────────────────────────────────────────────────────
function fmtValor(v, fonte) {
  if (v == null || isNaN(v)) return "N/D";
  if (fonte === "pnaes") {
    return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
}

function fmtRespostas(n) {
  if (n == null || isNaN(n)) return "N/D";
  return Number(n).toLocaleString("pt-BR");
}

function fmtLegendaValor(v, fonte) {
  if (fonte === "pnaes") {
    if (v >= 1e6) return "R$ " + (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return "R$ " + (v / 1e3).toFixed(0) + "k";
    return "R$ " + v.toFixed(0);
  }
  return v.toFixed(1) + "%";
}

// ── Fetch helpers ────────────────────────────────────────────────────────
const jsonCache = {};
async function carregarJSON(caminho) {
  if (jsonCache[caminho]) return jsonCache[caminho];
  const resp = await fetch(DATA_BASE + caminho);
  if (!resp.ok) throw new Error(`Falha ao carregar ${caminho}: ${resp.status}`);
  const data = await resp.json();
  jsonCache[caminho] = data;
  return data;
}

// ── Controles (selects) ──────────────────────────────────────────────────
function montarControles() {
  const selFaixa = document.getElementById("sel-faixa");
  const selAno = document.getElementById("sel-ano");
  const selHabito = document.getElementById("sel-habito");

  manifest.faixas.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    selFaixa.appendChild(opt);
  });

  // Habitos from manifest
  manifest.fontes.sisvan.habitos.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.slug;
    opt.textContent = h.label;
    selHabito.appendChild(opt);
  });

  // Populate anos for current faixa
  atualizarAnosDisponiveis();

  selFaixa.addEventListener("change", () => {
    atualizarAnosDisponiveis();
    atualizarAmbos();
  });
  selAno.addEventListener("change", atualizarAmbos);
  selHabito.addEventListener("change", atualizarSisvan);
}

function atualizarAnosDisponiveis() {
  const faixa = faixaSelecionada();
  const selAno = document.getElementById("sel-ano");
  const anoAtual = selAno.value;

  // Union of PNAES and SISVAN anos for this faixa
  const anosPnaes = manifest.fontes.pnaes.anos_por_faixa[faixa] || [];
  const anosSisvan = manifest.fontes.sisvan.anos_por_faixa[faixa] || [];
  const todosAnos = [...new Set([...anosPnaes, ...anosSisvan])].sort();

  selAno.innerHTML = "";
  todosAnos.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    selAno.appendChild(opt);
  });

  // Keep current selection if still valid, else pick last
  if (todosAnos.includes(Number(anoAtual))) {
    selAno.value = anoAtual;
  } else {
    selAno.value = todosAnos[todosAnos.length - 1];
  }
}

function faixaSelecionada() { return document.getElementById("sel-faixa").value; }
function anoSelecionado() { return document.getElementById("sel-ano").value; }
function habitoSelecionado() { return document.getElementById("sel-habito").value; }

// ── Map initialization ──────────────────────────────────────────────────
function criarMapa(containerId) {
  const m = L.map(containerId, {
    zoomSnap: 0.5,
    minZoom: 3,
    maxZoom: 8,
  }).setView([-14.5, -53], 4);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(m);

  // Info tooltip
  const info = L.control({ position: "topright" });
  info.onAdd = function () {
    this._div = L.DomUtil.create("div", "info-tooltip");
    this._div.style.display = "none";
    return this._div;
  };
  info.update = function (html) {
    if (html) {
      this._div.innerHTML = html;
      this._div.style.display = "block";
    } else {
      this._div.style.display = "none";
    }
  };
  info.addTo(m);

  return { map: m, info };
}

function inicializarMapas() {
  const p = criarMapa("map-pnaes");
  mapState.pnaes.map = p.map;
  mapState.pnaes.infoCtrl = p.info;

  const s = criarMapa("map-sisvan");
  mapState.sisvan.map = s.map;
  mapState.sisvan.infoCtrl = s.info;

  // Sync zoom/pan between maps
  mapState.pnaes.map.on("moveend", () => {
    const c = mapState.pnaes.map.getCenter();
    const z = mapState.pnaes.map.getZoom();
    if (mapState.sisvan.map.getZoom() !== z || !mapState.sisvan.map.getCenter().equals(c)) {
      mapState.sisvan.map.setView(c, z, { animate: false });
    }
  });
  mapState.sisvan.map.on("moveend", () => {
    const c = mapState.sisvan.map.getCenter();
    const z = mapState.sisvan.map.getZoom();
    if (mapState.pnaes.map.getZoom() !== z || !mapState.pnaes.map.getCenter().equals(c)) {
      mapState.pnaes.map.setView(c, z, { animate: false });
    }
  });
}

// ── Paint layer ─────────────────────────────────────────────────────────
function pintarCamada(tipo, dadosJSON) {
  const st = mapState[tipo];
  st.dados = dadosJSON;

  if (st.geoLayer) {
    st.map.removeLayer(st.geoLayer);
  }

  const estados = dadosJSON.estados;
  const fonte = dadosJSON.fonte;
  const label = dadosJSON.metrica_label;
  const valores = Object.values(estados).map((e) => e.valor);

  if (valores.length === 0) {
    document.getElementById(`legenda-${tipo}`).innerHTML = "<h4>Sem dados para este recorte</h4>";
    montarRanking(tipo, [], label);
    return;
  }

  const min = Math.min(...valores);
  const max = Math.max(...valores);

  st.geoLayer = L.geoJSON(estadosGeo, {
    style: (feature) => {
      const cod = feature.properties.codarea;
      const dado = estados[cod];
      const valor = dado ? dado.valor : null;
      return {
        fillColor: corPorValor(valor, min, max),
        weight: 1,
        opacity: 0.2,
        color: "#666",
        fillOpacity: 0.75,
      };
    },
    onEachFeature: (feature, layer) => {
      const cod = feature.properties.codarea;
      const dado = estados[cod];
      layer.on({
        mouseover: (e) => {
          e.target.setStyle({ weight: 3, color: "#333", opacity: 1 });
          e.target.bringToFront();
          const uf = dado ? dado.uf : "?";
          const nomeEstado = UF_NOMES[uf] || uf;
          const val = dado ? fmtValor(dado.valor, fonte) : "N/D";
          const resp = dado ? fmtRespostas(dado.n_respostas) : "N/D";
          st.infoCtrl.update(
            `<strong>${uf}</strong> — ${nomeEstado}<br>` +
            `${label}: ${val}<br>` +
            `Respostas: ${resp}`
          );
        },
        mouseout: (e) => {
          st.geoLayer.resetStyle(e.target);
          st.infoCtrl.update(null);
        },
        click: () => {
          drillDownMunicipio(tipo, cod);
        },
      });
    },
  }).addTo(st.map);

  montarLegenda(tipo, label, min, max, fonte);

  // Build ranking data
  const rankData = Object.entries(estados).map(([cod, d]) => ({
    codigo_UF: cod,
    uf: d.uf,
    estado: UF_NOMES[d.uf] || d.uf,
    valor: d.valor,
    n_respostas: d.n_respostas,
  }));
  montarRanking(tipo, rankData, label);
}

function montarLegenda(tipo, label, min, max, fonte) {
  const container = document.getElementById(`legenda-${tipo}`);
  const nFaixas = CORES.length;
  const step = (max - min) / nFaixas;

  let html = `<h4>${label}</h4><div class="legenda-items">`;
  for (let i = 0; i < nFaixas; i++) {
    const de = min + step * i;
    const ate = min + step * (i + 1);
    html += `<div class="legenda-item">
      <span class="legenda-cor" style="background:${CORES[i]}"></span>
      <span>${fmtLegendaValor(de, fonte)} — ${fmtLegendaValor(ate, fonte)}</span>
    </div>`;
  }
  html += `<div class="legenda-item">
    <span class="legenda-cor" style="background:${COR_SEM_DADO}"></span>
    <span>sem dado</span>
  </div></div>`;
  container.innerHTML = html;
}

// ── Ranking tables ──────────────────────────────────────────────────────
function montarRanking(tipo, rankData, labelValor) {
  rankData.sort((a, b) => b.valor - a.valor);
  const top10 = rankData.slice(0, 10);
  const bottom10 = rankData.slice(-10).reverse();

  const fonte = mapState[tipo].dados ? mapState[tipo].dados.fonte : "pnaes";

  function renderTable(rows) {
    if (rows.length === 0) return "<tr><td colspan='4'>Sem dados</td></tr>";
    let html = `<thead><tr><th>UF</th><th>Estado</th><th>${labelValor}</th><th>Respostas</th></tr></thead><tbody>`;
    rows.forEach((r) => {
      html += `<tr>
        <td>${r.uf}</td>
        <td>${r.estado}</td>
        <td class="num">${fmtValor(r.valor, fonte)}</td>
        <td class="num">${fmtRespostas(r.n_respostas)}</td>
      </tr>`;
    });
    html += "</tbody>";
    return html;
  }

  document.getElementById(`rank-${tipo}-top`).innerHTML = renderTable(top10);
  document.getElementById(`rank-${tipo}-bottom`).innerHTML = renderTable(bottom10);
}

// ── Municipal drill-down ────────────────────────────────────────────────
async function drillDownMunicipio(tipo, ufCode) {
  const faixa = faixaSelecionada();
  const ano = anoSelecionado();
  const fonte = tipo;  // "pnaes" or "sisvan"

  // Build paths from manifest patterns
  const geoPath = `geo/municipios/${ufCode}.json`;

  let valPath;
  if (fonte === "pnaes") {
    valPath = `map/municipios/pnaes/${faixa}/${ano}/${ufCode}.json`;
  } else {
    const habito = habitoSelecionado();
    valPath = `map/municipios/sisvan/${faixa}/${ano}/${habito}/${ufCode}.json`;
  }

  try {
    const [geoData, valData] = await Promise.all([
      carregarJSON(geoPath),
      carregarJSON(valPath),
    ]);
    pintarMunicipios(tipo, geoData, valData, ufCode);
  } catch (err) {
    console.warn(`Sem dados municipais para UF ${ufCode}:`, err.message);
    // Show brief error in legend area
    const sigla = UFCOD_TO_SIGLA[ufCode] || ufCode;
    document.getElementById(`legenda-${tipo}`).innerHTML =
      `<h4>Sem dados municipais para ${sigla} neste recorte</h4>`;
  }
}

function pintarMunicipios(tipo, geoData, valData, ufCode) {
  const st = mapState[tipo];
  st.drillUF = ufCode;
  st.dados = valData;

  if (st.geoLayer) {
    st.map.removeLayer(st.geoLayer);
  }

  const municipios = valData.municipios;
  const fonte = valData.fonte;
  const label = valData.metrica_label;
  const sigla = UFCOD_TO_SIGLA[ufCode] || ufCode;
  const valores = Object.values(municipios).map((m) => m.valor);

  if (valores.length === 0) {
    document.getElementById(`legenda-${tipo}`).innerHTML =
      `<h4>Sem dados municipais para ${sigla}</h4>`;
    montarRankingMunicipal(tipo, [], label);
    mostrarBotaoVoltar(tipo);
    return;
  }

  const min = Math.min(...valores);
  const max = Math.max(...valores);

  st.geoLayer = L.geoJSON(geoData, {
    style: (feature) => {
      const cod = feature.properties.codarea;
      const dado = municipios[cod];
      const valor = dado ? dado.valor : null;
      return {
        fillColor: corPorValor(valor, min, max),
        weight: 0.5,
        opacity: 0.3,
        color: "#666",
        fillOpacity: 0.75,
      };
    },
    onEachFeature: (feature, layer) => {
      const cod = feature.properties.codarea;
      const dado = municipios[cod];
      layer.on({
        mouseover: (e) => {
          e.target.setStyle({ weight: 2, color: "#333", opacity: 1 });
          e.target.bringToFront();
          const nome = dado ? dado.municipio : cod;
          const regiao = dado ? dado.regiao : "N/D";
          const val = dado ? fmtValor(dado.valor, fonte) : "N/D";
          const resp = dado ? fmtRespostas(dado.n_respostas) : "N/D";
          st.infoCtrl.update(
            `<strong>${nome}</strong><br>` +
            `UF: ${sigla} — Regiao: ${regiao}<br>` +
            `${label}: ${val}<br>` +
            `Respostas: ${resp}`
          );
        },
        mouseout: (e) => {
          st.geoLayer.resetStyle(e.target);
          st.infoCtrl.update(null);
        },
      });
    },
  }).addTo(st.map);

  // Fit map to UF bounds
  const bounds = st.geoLayer.getBounds();
  if (bounds.isValid()) {
    st.map.fitBounds(bounds, { padding: [20, 20], animate: true });
  }

  montarLegenda(tipo, `${label} — ${sigla}`, min, max, fonte);

  // Build municipal ranking
  const rankData = Object.entries(municipios).map(([cod, d]) => ({
    codigo_IBGE: cod,
    municipio: d.municipio,
    uf: sigla,
    regiao: d.regiao,
    valor: d.valor,
    n_respostas: d.n_respostas,
  }));
  montarRankingMunicipal(tipo, rankData, label);
  mostrarBotaoVoltar(tipo);
}

function montarRankingMunicipal(tipo, rankData, labelValor) {
  rankData.sort((a, b) => b.valor - a.valor);
  const top10 = rankData.slice(0, 10);
  const bottom10 = rankData.slice(-10).reverse();

  const fonte = mapState[tipo].dados ? mapState[tipo].dados.fonte : "pnaes";

  function renderTable(rows) {
    if (rows.length === 0) return "<tr><td colspan='5'>Sem dados</td></tr>";
    let html = `<thead><tr><th>Municipio</th><th>UF</th><th>Regiao</th><th>${labelValor}</th><th>Respostas</th></tr></thead><tbody>`;
    rows.forEach((r) => {
      html += `<tr>
        <td>${r.municipio}</td>
        <td>${r.uf}</td>
        <td>${r.regiao}</td>
        <td class="num">${fmtValor(r.valor, fonte)}</td>
        <td class="num">${fmtRespostas(r.n_respostas)}</td>
      </tr>`;
    });
    html += "</tbody>";
    return html;
  }

  document.getElementById(`rank-${tipo}-top`).innerHTML = renderTable(top10);
  document.getElementById(`rank-${tipo}-bottom`).innerHTML = renderTable(bottom10);
}

function mostrarBotaoVoltar(tipo) {
  const btnId = `btn-voltar-${tipo}`;
  let btn = document.getElementById(btnId);
  if (!btn) {
    btn = document.createElement("button");
    btn.id = btnId;
    btn.className = "btn-voltar";
    btn.textContent = "Voltar ao Brasil";
    btn.addEventListener("click", () => voltarAoBrasil(tipo));
    document.querySelector(`#map-${tipo}`).parentElement
      .querySelector(".painel-header").appendChild(btn);
  }
  btn.style.display = "inline-block";
}

function esconderBotaoVoltar(tipo) {
  const btn = document.getElementById(`btn-voltar-${tipo}`);
  if (btn) btn.style.display = "none";
}

async function voltarAoBrasil(tipo) {
  const st = mapState[tipo];
  st.drillUF = null;
  esconderBotaoVoltar(tipo);

  // Reset view to Brazil
  st.map.setView([-14.5, -53], 4, { animate: true });

  // Repaint state layer
  if (tipo === "pnaes") {
    await atualizarPnaes();
  } else {
    await atualizarSisvan();
  }
}

// ── CSV export ──────────────────────────────────────────────────────────
function exportarCSV(tipo) {
  const st = mapState[tipo];
  if (!st.dados) return;

  const faixa = faixaSelecionada();
  const ano = anoSelecionado();
  const fonte = st.dados.fonte;

  // Municipal view?
  if (st.drillUF && st.dados.municipios) {
    const sigla = UFCOD_TO_SIGLA[st.drillUF] || st.drillUF;
    let filename;
    if (fonte === "pnaes") {
      filename = `mapa_pnaes_munic_${sigla}_${faixa}_${ano}.csv`;
    } else {
      const habito = habitoSelecionado();
      filename = `mapa_sisvan_munic_${habito}_${sigla}_${faixa}_${ano}.csv`;
    }

    // CSV columns per VIZ_SPEC municipality: codigo_IBGE, municipio, UF, regiao, valor, n_respostas, codigo
    const header = "codigo_IBGE,municipio,UF,regiao,valor,n_respostas,codigo\n";
    const rows = Object.entries(st.dados.municipios).map(([cod, d]) =>
      `${cod},${d.municipio},${sigla},${d.regiao},${d.valor},${d.n_respostas},${cod}`
    ).join("\n");

    downloadCSV(header + rows, filename);
    return;
  }

  if (!st.dados.estados) return;

  // State view
  let filename;
  if (fonte === "pnaes") {
    filename = `mapa_pnaes_estados_${faixa}_${ano}.csv`;
  } else {
    const habito = habitoSelecionado();
    filename = `mapa_sisvan_${habito}_estados_${faixa}_${ano}.csv`;
  }

  // CSV columns per VIZ_SPEC: codigo_UF, UF, codigo, valor, n_respostas
  const header = "codigo_UF,UF,codigo,valor,n_respostas\n";
  const rows = Object.entries(st.dados.estados).map(([cod, d]) =>
    `${cod},${d.uf},${cod},${d.valor},${d.n_respostas}`
  ).join("\n");

  downloadCSV(header + rows, filename);
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Update maps ─────────────────────────────────────────────────────────
async function atualizarPnaes() {
  const st = mapState.pnaes;

  // If in municipal drill-down, reload municipal data for same UF
  if (st.drillUF) {
    await drillDownMunicipio("pnaes", st.drillUF);
    return;
  }

  esconderBotaoVoltar("pnaes");

  const faixa = faixaSelecionada();
  const ano = anoSelecionado();

  const entrada = manifest.map_states_pnaes.find(
    (e) => e.faixa === faixa && String(e.ano) === String(ano)
  );

  if (!entrada) {
    console.warn(`Sem dados PNAES para faixa=${faixa}, ano=${ano}`);
    if (st.geoLayer) st.map.removeLayer(st.geoLayer);
    st.geoLayer = null;
    st.dados = null;
    document.getElementById("legenda-pnaes").innerHTML = "<h4>Sem dados PNAES para este recorte</h4>";
    montarRanking("pnaes", [], "");
    return;
  }

  const dados = await carregarJSON(entrada.path);
  pintarCamada("pnaes", dados);
}

async function atualizarSisvan() {
  const st = mapState.sisvan;

  // If in municipal drill-down, reload municipal data for same UF
  if (st.drillUF) {
    await drillDownMunicipio("sisvan", st.drillUF);
    return;
  }

  esconderBotaoVoltar("sisvan");

  const faixa = faixaSelecionada();
  const ano = anoSelecionado();
  const habito = habitoSelecionado();

  const entrada = manifest.map_states_sisvan.find(
    (e) => e.faixa === faixa && String(e.ano) === String(ano) && e.habito === habito
  );

  if (!entrada) {
    console.warn(`Sem dados SISVAN para faixa=${faixa}, ano=${ano}, habito=${habito}`);
    if (st.geoLayer) st.map.removeLayer(st.geoLayer);
    st.geoLayer = null;
    st.dados = null;
    document.getElementById("legenda-sisvan").innerHTML = "<h4>Sem dados SISVAN para este recorte</h4>";
    montarRanking("sisvan", [], "");
    return;
  }

  const dados = await carregarJSON(entrada.path);
  pintarCamada("sisvan", dados);
}

async function atualizarAmbos() {
  await Promise.all([atualizarPnaes(), atualizarSisvan()]);
}

// ── Tab switching ───────────────────────────────────────────────────────
let activeTab = "mapa";
let mapInitialized = false;
let seriesInitialized = false;

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab === activeTab) return;

      // Toggle active class on buttons
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Toggle tab content visibility
      document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
      const targetId = tab === "mapa" ? "tab-mapa" : "tab-series";
      document.getElementById(targetId).classList.add("active");

      activeTab = tab;

      // Invalidate Leaflet map size when switching back to map
      if (tab === "mapa") {
        setTimeout(() => {
          mapState.pnaes.map.invalidateSize();
          mapState.sisvan.map.invalidateSize();
        }, 50);
      }

      // Lazy-init series on first switch
      if (tab === "series" && !seriesInitialized) {
        initSeries();
        seriesInitialized = true;
      }
    });
  });
}

// ── Series Temporais module ─────────────────────────────────────────────
// Faixa label mapping (matches series.py FAIXAS_LABEL)
const FAIXA_LABELS = {
  "Adolescentes":            "Adolescentes",
  "Crianças_de_5_a_9_anos": "Criancas de 5 a 9 anos",
  "Crianças_de_2_a_4_anos": "Criancas de 2 a 4 anos",
};

const REGIOES = ["CENTRO-OESTE", "NORDESTE", "NORTE", "SUDESTE", "SUL"];
const UFS_SIGLA = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

let seriesCache = {};
let currentSeriesData = null;

function initSeries() {
  const selFaixa = document.getElementById("sel-series-faixa");
  const selNivel = document.getElementById("sel-series-nivel");
  const selHabito = document.getElementById("sel-series-habito");

  // Populate faixa from manifest.series.faixas
  const faixas = (manifest.series && manifest.series.faixas) || [];
  selFaixa.innerHTML = "";
  faixas.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = FAIXA_LABELS[f] || f;
    selFaixa.appendChild(opt);
  });

  // Populate habitos from manifest.series.habitos
  const habitos = (manifest.series && manifest.series.habitos) || [];
  selHabito.innerHTML = "";
  habitos.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.slug;
    opt.textContent = h.label;
    selHabito.appendChild(opt);
  });

  // Decomposicao: habito dropdown (single series to decompose)
  const selDecompHabito = document.getElementById("sel-decomp-habito");
  selDecompHabito.innerHTML = "";
  habitos.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.slug;
    opt.textContent = h.label;
    selDecompHabito.appendChild(opt);
  });

  selFaixa.addEventListener("change", onSeriesSelectionChange);
  selNivel.addEventListener("change", onSeriesNivelChange);
  selHabito.addEventListener("change", renderSeriesChart);
  document.getElementById("sel-series-grupo").addEventListener("change", renderSeriesChart);
  selDecompHabito.addEventListener("change", renderDecomp);
  document.getElementById("sel-decomp-grupo").addEventListener("change", renderDecomp);
  document.getElementById("sel-ano-ini").addEventListener("change", onAnoChange);
  document.getElementById("sel-ano-fim").addEventListener("change", onAnoChange);

  // Initial load
  onSeriesNivelChange();
}

function onSeriesNivelChange() {
  const nivel = document.getElementById("sel-series-nivel").value;
  const grupoContainer = document.getElementById("series-grupo-container");
  const selGrupo = document.getElementById("sel-series-grupo");
  const decompGrupoContainer = document.getElementById("decomp-grupo-container");
  const selDecompGrupo = document.getElementById("sel-decomp-grupo");

  if (nivel === "nacional") {
    grupoContainer.style.display = "none";
    decompGrupoContainer.style.display = "none";
  } else {
    grupoContainer.style.display = "";
    selGrupo.innerHTML = "";

    // Decomposicao decompoe UMA serie -> grupo unico (single-select)
    decompGrupoContainer.style.display = "";
    selDecompGrupo.innerHTML = "";

    const items = nivel === "regiao" ? REGIOES : UFS_SIGLA;
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      opt.selected = true; // select all by default
      selGrupo.appendChild(opt);

      const optD = document.createElement("option");
      optD.value = item;
      optD.textContent = item;
      selDecompGrupo.appendChild(optD);
    });

    // Default: select first 5 for UF (too many otherwise)
    if (nivel === "uf") {
      Array.from(selGrupo.options).forEach((opt, i) => {
        opt.selected = i < 5;
      });
    }
  }

  onSeriesSelectionChange();
}

async function onSeriesSelectionChange() {
  const faixa = document.getElementById("sel-series-faixa").value;
  const nivel = document.getElementById("sel-series-nivel").value;
  if (!faixa) return;

  const path = `series/${nivel}/${faixa}.json`;

  try {
    // Lazy-load: use cache to avoid re-fetching
    if (!seriesCache[path]) {
      seriesCache[path] = await carregarJSON(path);
    }
    currentSeriesData = seriesCache[path];
    popularAnos(currentSeriesData);
    renderSeriesChart();
  } catch (err) {
    console.warn("Erro ao carregar serie:", err.message);
    document.getElementById("series-chart").innerHTML =
      `<p style="padding:2rem;color:#999;">Sem dados de serie para este recorte.</p>`;
  }
}

// ── Periodo (faixa de anos) ──────────────────────────────────────────────
function anoRange() {
  const ini = parseInt(document.getElementById("sel-ano-ini").value, 10);
  const fim = parseInt(document.getElementById("sel-ano-fim").value, 10);
  return { ini: isNaN(ini) ? -Infinity : ini, fim: isNaN(fim) ? Infinity : fim };
}

function filtrarPorAno(dados) {
  const { ini, fim } = anoRange();
  return dados.filter((d) => {
    const y = parseInt(d.mes.slice(0, 4), 10);
    return y >= ini && y <= fim;
  });
}

function popularAnos(data) {
  const selIni = document.getElementById("sel-ano-ini");
  const selFim = document.getElementById("sel-ano-fim");
  const anos = [...new Set(data.dados.map((d) => d.mes.slice(0, 4)))].sort();
  const prevIni = selIni.value;
  const prevFim = selFim.value;
  const fill = (sel) => {
    sel.innerHTML = "";
    anos.forEach((a) => {
      const o = document.createElement("option");
      o.value = a;
      o.textContent = a;
      sel.appendChild(o);
    });
  };
  fill(selIni);
  fill(selFim);
  selIni.value = anos.includes(prevIni) ? prevIni : anos[0];
  selFim.value = anos.includes(prevFim) ? prevFim : anos[anos.length - 1];
}

function onAnoChange() {
  // Garante ano inicial <= ano final
  const selIni = document.getElementById("sel-ano-ini");
  const selFim = document.getElementById("sel-ano-fim");
  if (parseInt(selIni.value, 10) > parseInt(selFim.value, 10)) {
    selFim.value = selIni.value;
  }
  renderSeriesChart(); // chama renderDecomp ao final
}

function renderSeriesChart() {
  if (!currentSeriesData) return;

  const nivel = document.getElementById("sel-series-nivel").value;
  const habitoSlug = document.getElementById("sel-series-habito").value;
  const chartDiv = document.getElementById("series-chart");
  const caption = document.getElementById("series-caption");

  const data = currentSeriesData;
  const dados = filtrarPorAno(data.dados);
  const habitoMeta = data.habitos.find((h) => h.slug === habitoSlug);
  const habitoLabel = habitoMeta ? habitoMeta.label : habitoSlug;
  const faixaLabel = FAIXA_LABELS[data.faixa] || data.faixa;
  const { ini: anoIni, fim: anoFim } = anoRange();

  const traces = [];
  const layout = {
    title: `${habitoLabel} — ${faixaLabel} (${anoIni}–${anoFim})`,
    xaxis: { title: "Mes", tickformat: "%b %Y", tickangle: -30 },
    yaxis: {
      title: "Prevalencia (%)",
      ticksuffix: "%",
      range: [0, 110],
      gridcolor: "rgba(180,180,180,0.7)",
    },
    legend: { orientation: "h", yanchor: "top", y: -0.25, xanchor: "left", x: 0 },
    height: 560,
    hovermode: "x unified",
    plot_bgcolor: "rgba(0,0,0,0)",
    paper_bgcolor: "rgba(0,0,0,0)",
    margin: { b: 160, t: 50, l: 60, r: 20 },
  };

  if (nivel === "nacional") {
    // All habitos on one chart
    const months = dados.map((d) => d.mes + "-01");
    data.habitos.forEach((h) => {
      const yVals = dados.map((d) => d[h.slug] != null ? d[h.slug] : null);
      traces.push({
        x: months,
        y: yVals,
        mode: "lines+markers",
        name: h.label,
        line: { width: 2 },
        marker: { size: 4 },
        connectgaps: false,
      });
    });
    layout.title = `${faixaLabel} — Todos os habitos (${anoIni}–${anoFim})`;
    caption.textContent = `${dados.length} meses no periodo.`;
  } else {
    // One habito, multiple groups (regiao or UF)
    const grupoKey = nivel === "regiao" ? "regiao" : "uf";
    const selGrupo = document.getElementById("sel-series-grupo");
    const selectedGrupos = Array.from(selGrupo.selectedOptions).map((o) => o.value);

    if (selectedGrupos.length === 0) {
      chartDiv.innerHTML = `<p style="padding:2rem;color:#999;">Selecione ao menos um grupo para comparar.</p>`;
      caption.textContent = "";
      return;
    }

    // Group data by grupo
    const byGrupo = {};
    dados.forEach((d) => {
      const g = d[grupoKey];
      if (!selectedGrupos.includes(g)) return;
      if (!byGrupo[g]) byGrupo[g] = [];
      byGrupo[g].push(d);
    });

    Object.entries(byGrupo).forEach(([grupo, records]) => {
      const months = records.map((d) => d.mes + "-01");
      const yVals = records.map((d) => d[habitoSlug] != null ? d[habitoSlug] : null);
      traces.push({
        x: months,
        y: yVals,
        mode: "lines+markers",
        name: grupo,
        line: { width: 2 },
        marker: { size: 4 },
        connectgaps: false,
      });
    });

    const nGrupos = selectedGrupos.length;
    const nTotal = nivel === "regiao" ? REGIOES.length : UFS_SIGLA.length;
    caption.textContent = `${nGrupos} de ${nTotal} ${nivel === "regiao" ? "regioes" : "estados"} selecionados.`;
  }

  Plotly.newPlot(chartDiv, traces, layout, { responsive: true, displayModeBar: true });

  renderDecomp();
}

// ── Decomposicao sazonal (cliente) ───────────────────────────────────────
// Replica statsmodels seasonal_decompose(model='additive', period=12):
//  - trend  = media movel centrada, filtro par [0.5,1..1,0.5]/12 (len 13), 6 NaN/ponta
//  - season = media do detrended por posicao (t % 12), de-meada pela media das 12
//  - resid  = observado - trend - season
const DECOMP_PERIODO = 12;

function decompor(valores) {
  const n = valores.length;
  const m = DECOMP_PERIODO;
  const half = m / 2; // 6
  const pesos = [0.5, ...Array(m - 1).fill(1), 0.5].map((w) => w / m); // len 13

  const trend = new Array(n).fill(null);
  for (let t = half; t < n - half; t++) {
    let s = 0;
    for (let k = -half; k <= half; k++) s += pesos[k + half] * valores[t + k];
    trend[t] = s;
  }

  const detrended = valores.map((v, t) => (trend[t] == null ? null : v - trend[t]));

  // media por posicao t % 12
  const soma = new Array(m).fill(0);
  const cont = new Array(m).fill(0);
  detrended.forEach((d, t) => {
    if (d == null) return;
    soma[t % m] += d;
    cont[t % m] += 1;
  });
  const media = soma.map((s, i) => (cont[i] > 0 ? s / cont[i] : 0));
  const grande = media.reduce((a, b) => a + b, 0) / m;
  const fator = media.map((v) => v - grande);

  const seasonal = valores.map((_, t) => fator[t % m]);
  const resid = valores.map((v, t) =>
    trend[t] == null ? null : v - trend[t] - seasonal[t]
  );

  return { trend, seasonal, resid };
}

// Constroi serie mensal continua (interpola lacunas internas; apara pontas vazias).
function serieMensalContinua(registros, slug, filtro) {
  const mapa = {};
  registros.forEach((d) => {
    if (filtro && !filtro(d)) return;
    const v = d[slug];
    if (v != null) mapa[d.mes] = v;
  });
  const meses = Object.keys(mapa).sort();
  if (meses.length === 0) return { xs: [], ys: [] };

  const idx = (ym) => {
    const [y, mo] = ym.split("-").map(Number);
    return y * 12 + (mo - 1);
  };
  const label = (i) => {
    const y = Math.floor(i / 12);
    const mo = (i % 12) + 1;
    return `${y}-${String(mo).padStart(2, "0")}`;
  };

  const ini = idx(meses[0]);
  const fim = idx(meses[meses.length - 1]);
  const xs = [];
  const ys = [];
  for (let i = ini; i <= fim; i++) {
    xs.push(label(i));
    const ym = label(i);
    ys.push(mapa[ym] != null ? mapa[ym] : null);
  }

  // interpolacao linear de lacunas internas (pontas ja sao validas)
  let last = 0;
  while (last < ys.length) {
    if (ys[last] != null) {
      let next = last + 1;
      while (next < ys.length && ys[next] == null) next++;
      if (next < ys.length && next > last + 1) {
        const passo = (ys[next] - ys[last]) / (next - last);
        for (let j = last + 1; j < next; j++) ys[j] = ys[last] + passo * (j - last);
      }
      last = next;
    } else {
      last++;
    }
  }

  return { xs, ys };
}

function renderDecomp() {
  const chartDiv = document.getElementById("decomp-chart");
  const caption = document.getElementById("decomp-caption");
  if (!currentSeriesData) {
    Plotly.purge(chartDiv);
    caption.textContent = "";
    return;
  }

  const nivel = document.getElementById("sel-series-nivel").value;
  const slug = document.getElementById("sel-decomp-habito").value;
  const data = currentSeriesData;
  const habMeta = data.habitos.find((h) => h.slug === slug);
  const habLabel = habMeta ? habMeta.label : slug;

  const { ini, fim } = anoRange();
  const anoOk = (d) => {
    const y = parseInt(d.mes.slice(0, 4), 10);
    return y >= ini && y <= fim;
  };

  let filtro = anoOk;
  let escopo = "Nacional";
  if (nivel !== "nacional") {
    const grupoKey = nivel === "regiao" ? "regiao" : "uf";
    const grupo = document.getElementById("sel-decomp-grupo").value;
    if (!grupo) {
      Plotly.purge(chartDiv);
      caption.textContent = "Selecione um grupo para decompor.";
      return;
    }
    filtro = (d) => anoOk(d) && d[grupoKey] === grupo;
    escopo = grupo;
  }

  const { xs, ys } = serieMensalContinua(data.dados, slug, filtro);
  const xsDia = xs.map((m) => m + "-01");

  if (xs.length < 24) {
    Plotly.purge(chartDiv);
    caption.textContent =
      `Sao necessarios ao menos 24 meses para decomposicao sazonal. ` +
      `Periodo atual tem ${xs.length} mes(es).`;
    return;
  }

  const { trend, seasonal, resid } = decompor(ys);

  const traces = [
    {
      x: xsDia, y: trend, xaxis: "x", yaxis: "y",
      mode: "lines", name: "Tendencia", line: { color: "#1f77b4", width: 2 },
      connectgaps: false,
    },
    {
      x: xsDia, y: seasonal, xaxis: "x2", yaxis: "y2",
      mode: "lines", name: "Sazonalidade", line: { color: "#ff7f0e", width: 2 },
    },
    {
      x: xsDia, y: resid, xaxis: "x3", yaxis: "y3",
      mode: "markers", name: "Residuo", marker: { color: "#2ca02c", size: 4 },
      connectgaps: false,
    },
  ];

  const eixoY = {
    ticksuffix: "%",
    gridcolor: "rgba(180,180,180,0.7)",
    showgrid: true,
    gridwidth: 1,
  };
  const layout = {
    grid: { rows: 3, columns: 1, pattern: "independent", roworder: "top to bottom" },
    height: 650,
    showlegend: false,
    title: `Decomposicao — ${habLabel} (${escopo})`,
    plot_bgcolor: "rgba(0,0,0,0)",
    paper_bgcolor: "rgba(0,0,0,0)",
    margin: { b: 60, t: 70, l: 60, r: 20 },
    yaxis: eixoY, yaxis2: eixoY, yaxis3: eixoY,
    xaxis: { showticklabels: false },
    xaxis2: { showticklabels: false },
    xaxis3: { tickformat: "%b %Y", tickangle: -30 },
    annotations: [
      { text: "Tendencia", showarrow: false, x: 0, xref: "paper", y: 1.0, yref: "paper", xanchor: "left", font: { size: 13 } },
      { text: "Sazonalidade", showarrow: false, x: 0, xref: "paper", y: 0.63, yref: "paper", xanchor: "left", font: { size: 13 } },
      { text: "Residuo", showarrow: false, x: 0, xref: "paper", y: 0.28, yref: "paper", xanchor: "left", font: { size: 13 } },
    ],
  };

  Plotly.newPlot(chartDiv, traces, layout, { responsive: true, displayModeBar: true });
  caption.textContent = `${xs.length} meses — modelo aditivo, periodo=12.`;
}

// ── Initialization ──────────────────────────────────────────────────────
async function init() {
  try {
    manifest = await carregarJSON("manifest.json");
    estadosGeo = await carregarJSON(manifest.geo.estados);

    setupTabs();
    montarControles();
    inicializarMapas();
    mapInitialized = true;

    // CSV buttons
    document.getElementById("btn-csv-pnaes").addEventListener("click", () => exportarCSV("pnaes"));
    document.getElementById("btn-csv-sisvan").addEventListener("click", () => exportarCSV("sisvan"));

    await atualizarAmbos();
  } catch (err) {
    console.error("Erro ao inicializar dashboard:", err);
    document.getElementById("map-pnaes").innerHTML =
      `<p style="padding:2rem;color:red;">Erro: ${err.message}</p>`;
  }
}

init();
