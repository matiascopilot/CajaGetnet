/**
 * getnet-adapter.js
 *
 * Wraps the Getnet SDK so every command sends the date format that the
 * real POS hardware expects: "DD-MM-YYYY HH:MM:SS"
 *
 * Problem:
 *   getnet.js calls  new Date().toISOString()  which returns
 *   "2026-05-27T16:11:08.405Z" — the POS rejects this and replies
 *   { "Received": false } which triggers the 3-second Received-timeout.
 *
 * Solution (zero library changes):
 *   Temporarily replace Date.prototype.toISOString with a function that
 *   returns the format the POS wants, run the SDK call, then restore it.
 */

import Getnet from './getnet';

/** Returns "DD-MM-YYYY HH:MM:SS" in LOCAL time (what the POS expects). */
function formatPOSDate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${p(date.getDate())}-${p(date.getMonth() + 1)}-${date.getFullYear()} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

/**
 * Temporarily patches Date.prototype.toISOString → POS format,
 * executes fn(), then unconditionally restores the original.
 */
function withPOSDate(fn) {
  const original = Date.prototype.toISOString;
  Date.prototype.toISOString = function () {
    return formatPOSDate(this);
  };
  try {
    return fn();
  } finally {
    Date.prototype.toISOString = original;
  }
}

/**
 * Drop-in replacement for the default Getnet export.
 * All command functions are wrapped; setup helpers are passed through as-is.
 */
const GetnetAdapter = {
  // ── SDK constants / setup (no date involved) ────────────────────────────────
  POSCommands:                  Getnet.POSCommands,
  SetCallback:                  Getnet.SetCallback,
  SetLogCallback:               Getnet.SetLogCallback,
  SetTimeErrorCallback:         Getnet.SetTimeErrorCallback,
  establecerWebSerialCommunication: Getnet.establecerWebSerialCommunication,
  utilizarAgentePOS:            Getnet.utilizarAgentePOS,
  establecerPuertoFijo:         Getnet.establecerPuertoFijo,
  establecerPuertoManual:       Getnet.establecerPuertoManual,
  Desconectar:                  Getnet.Desconectar,

  // ── Commands – each one forces POS-format date during execution ─────────────
  Poll:            (...a) => withPOSDate(() => Getnet.Poll(...a)),
  Sale:            (...a) => withPOSDate(() => Getnet.Sale(...a)),
  LastVoucher:     (...a) => withPOSDate(() => Getnet.LastVoucher(...a)),
  Refund:          (...a) => withPOSDate(() => Getnet.Refund(...a)),
  Close:           (...a) => withPOSDate(() => Getnet.Close(...a)),
  Totals:          (...a) => withPOSDate(() => Getnet.Totals(...a)),
  Details:         (...a) => withPOSDate(() => Getnet.Details(...a)),
  SetNormalMode:   (...a) => withPOSDate(() => Getnet.SetNormalMode(...a)),
  Return:          (...a) => withPOSDate(() => Getnet.Return(...a)),
  DuplicateOthers: (...a) => withPOSDate(() => Getnet.DuplicateOthers(...a)),
  SalesBySeller:   (...a) => withPOSDate(() => Getnet.SalesBySeller(...a)),
  TipReport:       (...a) => withPOSDate(() => Getnet.TipReport(...a)),
  DefaultSaleType: (...a) => withPOSDate(() => Getnet.DefaultSaleType(...a)),
  ParameterReport: (...a) => withPOSDate(() => Getnet.ParameterReport(...a)),
  SimReport:       (...a) => withPOSDate(() => Getnet.SimReport(...a)),
  CancelSale:      (...a) => withPOSDate(() => Getnet.CancelSale(...a)),
};

export default GetnetAdapter;
