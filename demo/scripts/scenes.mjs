/** The four screen segments of the storyboard. Each one sets up its own state, so any
 * clip can be re-shot alone. Setup runs before cut() and is trimmed out. */
import { SITE } from './shoot.mjs';

const START = `${SITE}/?seed=demo`;
const WRONG = { amount: '201500', tx: 'POS-1049', wb: 'WB-3307' };
const RIGHT = { amount: '45000', tx: 'POS-1042', wb: 'WB-3311' };

const amountBox = (page) => page.getByPlaceholder('e.g. 45,000');
const txBox = (page) => page.getByPlaceholder('e.g. POS-1042');
const wbBox = (page) => page.getByPlaceholder('e.g. WB-3311');
const submitBtn = (page) => page.getByRole('button', { name: /Submit Reconciliation/i });

/** Fast, unwatched setup: get into the workspace with a session running. */
async function enterWorkspace(page, name = 'Judge Adaeze') {
  await page.goto(START, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('textbox').first().fill(name);
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await page.waitForURL('**/workspace', { timeout: 30000 });
  await amountBox(page).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
}

/** Fast, unwatched submission used to reach a later state. */
async function fastSubmit(page, values) {
  await amountBox(page).fill(values.amount);
  await txBox(page).fill(values.tx);
  await wbBox(page).fill(values.wb);
  const res = page.waitForResponse(
    (r) => r.url().includes('/api/session/submit') && r.request().method() === 'POST',
    { timeout: 20000 });
  await submitBtn(page).click();
  await res;
  await page.waitForTimeout(1500);
}

export const scenes = {
  // S4 — the scenario and the three messy tables.
  async s4({ page, ui, cut }) {
    await enterWorkspace(page);
    cut();
    await ui.pause(1400);
    await ui.moveTo(page.getByText('From:').first());
    await ui.pause(1600);
    await ui.scrollBy(page.getByText(/Welcome to the Alimosho/i).first(), 260, { steps: 22 });
    await ui.pause(1500);

    await ui.click(page.getByRole('tab', { name: /Warehouse Waybills/i }), { settle: 2200 });
    await ui.moveTo(page.getByRole('cell', { name: 'Golde-Penny-Semovita-10kg' }).first());
    await ui.pause(2000);

    await ui.click(page.getByRole('tab', { name: /Bank Statements/i }), { settle: 2200 });
    await ui.pause(1600);

    await ui.click(page.getByRole('tab', { name: /POS Logs/i }), { settle: 1800 });
    // the messy date column, then the messy amount column
    await ui.moveTo(page.getByRole('cell', { name: 'Oct 13 2026' }).first());
    await ui.pause(2400);
    await ui.moveTo(page.getByRole('cell', { name: '₦7,500.00' }).first());
    await ui.pause(2600);
    await ui.moveTo(page.getByRole('cell', { name: '45,000', exact: true }).first());
    await ui.pause(3000);
  },

  // S5 — a wrong attempt, red fields, and a hint that gives nothing away.
  async s5({ page, ui, cut }) {
    await enterWorkspace(page);
    cut();
    await ui.pause(900);
    await ui.type(amountBox(page), WRONG.amount, { settle: 500 });
    await ui.type(txBox(page), WRONG.tx, { settle: 500 });
    await ui.type(wbBox(page), WRONG.wb, { settle: 700 });

    const res = page.waitForResponse(
      (r) => r.url().includes('/api/session/submit') && r.request().method() === 'POST',
      { timeout: 20000 });
    await ui.click(submitBtn(page), { settle: 400 });
    await res;
    await ui.pause(2400);

    await ui.moveTo(txBox(page));
    await ui.pause(2600);
    await ui.moveTo(page.getByText(/Hint Level/i).first());
    await ui.pause(4200);
    await ui.scrollBy(page.getByText(/Hint Level/i).first(), 120, { steps: 10 });
    await ui.pause(4000);
  },

  // S6 — the correct answer, three greens, the badge.
  async s6({ page, ui, cut }) {
    await enterWorkspace(page);
    await fastSubmit(page, WRONG);
    cut();
    await ui.pause(800);
    await amountBox(page).fill('');
    await ui.type(amountBox(page), RIGHT.amount, { settle: 400 });
    await txBox(page).fill('');
    await ui.type(txBox(page), RIGHT.tx, { settle: 400 });
    await wbBox(page).fill('');
    await ui.type(wbBox(page), RIGHT.wb, { settle: 600 });

    const res = page.waitForResponse(
      (r) => r.url().includes('/api/session/submit') && r.request().method() === 'POST',
      { timeout: 20000 });
    await ui.click(submitBtn(page), { settle: 400 });
    await res;
    await ui.pause(2600);
    // let the three greens and then the credential land
    const modal = page.locator('dialog[open]').first();
    await modal.waitFor({ state: 'visible', timeout: 20000 });
    await ui.pause(2600);
    await ui.moveTo(modal.locator('h2').first());
    await ui.pause(4200);
    await ui.moveTo(modal.getByText(/sha256:/i).first());
    await ui.pause(3600);
  },

  // S8 — the credential, employer verification, and the tamper test.
  async s8({ page, ui, cut }) {
    await enterWorkspace(page);
    await fastSubmit(page, WRONG);
    await fastSubmit(page, RIGHT);
    const modal = page.locator('dialog[open]').first();
    await modal.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1200);
    cut();
    await ui.pause(1600);

    await ui.click(modal.getByRole('button', { name: 'View raw credential' }), { settle: 1800 });
    await ui.scrollBy(modal.locator('pre').first(), 220, { steps: 18 });
    await ui.pause(2600);

    await ui.click(modal.getByRole('button', { name: 'Simulate employer verification' }), { settle: 600 });
    await modal.getByText(/Cryptographically verified/i).first()
      .waitFor({ state: 'visible', timeout: 20000 });
    await ui.pause(3600);

    await ui.click(modal.getByRole('button', { name: 'Tamper test' }), { settle: 600 });
    await modal.getByText(/signature_invalid/i).first()
      .waitFor({ state: 'visible', timeout: 20000 });
    await ui.pause(4200);
    await ui.scrollBy(modal.getByText(/signature_invalid/i).first(), 160, { steps: 12 });
    await ui.pause(3200);
  },
};

export const TARGETS = { s4: 28, s5: 27, s6: 20, s8: 30 };
