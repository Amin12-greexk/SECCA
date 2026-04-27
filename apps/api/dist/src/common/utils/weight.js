"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBps = exports.calcRendemenNetBps = exports.calcRendemenMainBps = exports.calcSusutHilang = exports.calcSusutProses = exports.roundDryWeight = void 0;
const roundDryWeight = (wetWeightGram, moistureBps) => Math.round((wetWeightGram * (10000 - moistureBps)) / 10000);
exports.roundDryWeight = roundDryWeight;
const calcSusutProses = (byProductGram) => byProductGram;
exports.calcSusutProses = calcSusutProses;
const calcSusutHilang = (dryInGram, mainOutGram, byProductGram) => dryInGram - (mainOutGram + byProductGram);
exports.calcSusutHilang = calcSusutHilang;
const calcRendemenMainBps = (dryInGram, mainOutGram) => (0, exports.toBps)(mainOutGram, dryInGram);
exports.calcRendemenMainBps = calcRendemenMainBps;
const calcRendemenNetBps = (dryInGram, mainOutGram, byProductGram) => (0, exports.toBps)(mainOutGram + byProductGram, dryInGram);
exports.calcRendemenNetBps = calcRendemenNetBps;
const toBps = (part, total) => {
    if (total <= 0) {
        return 0;
    }
    return Math.round((part / total) * 10000);
};
exports.toBps = toBps;
//# sourceMappingURL=weight.js.map