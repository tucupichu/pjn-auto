import { chromium } from '@playwright/test';
import fetch from 'node-fetch';

const {
  PJN_USER,
  PJN_PASS,
  SHEET_ENDPOINT,   // tu URL de Apps Script que termina en /exec
  SHEET_TOKEN,      // el mismo API_TOKEN que cargaste en Apps Script
  EXPEDIENTES,      // lista separada por comas: 22583/14,22853/14
  SHEET_TAB_NAME    // nombre exacto de la Hoja: CONTROL DE JUICIOS DETALLADO (05MAR24)
} = process.env;

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function loginPJN(page) {
  // TODO: adaptar a tu portal real (solo si hace falta login)
  // await page.goto('https://<PJN>/login');
  // await page.fill('#usuario', PJN_USER);
  // await page.fill('#password', PJN_PASS);
  // await page.click('button[type=submit]');
  // await page.waitForLoadState('networkidle');
}

async function consultarExpediente(page, numero) {
  // TODO: Navegar al buscador y consultar "numero"
  // await page.goto('https://<PJN>/buscador');
  // await page.fill('#expediente', numero);
  // await page.click('#buscar');
  // await page.waitForSelector('table.actuaciones');

  // TODO: Parsear campos reales desde el HTML:
  // const caratula = await page.textContent('#caratula');
  // const fuero = await page.textContent('#fuero');
  // const juzgado = await page.textContent('#juzgado');
  // const link = page.url();
  // const fila = page.locator('table.actuaciones tbody tr').first();
  // const fechaUlt = await fila.locator('td').nth(0).textContent();
  // const actoUlt = await fila.locator('td').nth(1).textContent();

  // --- MODO DEMO (para que pruebes el flujo end-to-end) ---
  const caratula = 'Carátula DEMO';
  const fuero = 'Civil y Comercial Federal';
  const juzgado = 'Juzgado X Sec. Y';
  const link = 'https://pjn.ejemplo/expediente?num=' + encodeURIComponent(numero);
  const fechaUlt = new Date().toLocaleDateString('es-AR'); // hoy
  const actoUlt = 'Se agrega escrito de parte; pase a despacho (DEMO)';

  // Hash opcional (si luego queremos deduplicar desde el robot):
  const hash = Buffer.from(`${numero}|${fechaUlt}|${actoUlt}`).toString('base64').slice(0,16);

  return {
    "expediente": numero,
    "Carátula": caratula,
    "Fuero": fuero,
    "Juzgado": juzgado,
    "Link": link,
    "Último acto": actoUlt,
    "Fecha último": fechaUlt,
    "Observaciones": "Actualización automática",
    "Hash_acto": hash
  };
}

async function main() {
  const expedientes = (EXPEDIENTES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!SHEET_ENDPOINT || !SHEET_TOKEN || !SHEET_TAB_NAME || expedientes.length === 0) {
    console.error('Faltan variables de entorno requeridas.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Si tu portal requiere login, descomentar:
  // await loginPJN(page);

  const updates = [];
  for (const num of expedientes) {
    try {
      const item = await consultarExpediente(page, num);
      updates.push(item);
      await delay(500); // pequeño respiro entre consultas
    } catch (e) {
      updates.push({ expediente: num, Observaciones: 'ERROR: ' + String(e) });
    }
  }

  await browser.close();

  // Enviar al puente (Apps Script)
  const payload = {
    token: SHEET_TOKEN,
    sheetName: SHEET_TAB_NAME, // <<<<<< NOMBRE DE TU HOJA EXACTO
    updates
  };

  const resp = await fetch(SHEET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await resp.json();
  console.log('Respuesta Apps Script:', json);
  if (!json.ok) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
