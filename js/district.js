// js/district.js
// Ορίζει τις 8 συνοικίες της πόλης πάνω στο grid (σε ζώνες 3x3 macro-cells),
// το στυλ κτιρίων της καθεμιάς, και βοηθητικές συναρτήσεις για να βρίσκουμε
// σε ποια συνοικία βρίσκεται ένα block ή μια θέση μέσα στον κόσμο.

import { CONFIG } from './config.js';

export const DISTRICTS = {
    industrial: {
        name: 'INDUSTRIAL ZONE',
        style: 'warehouse',
        heightRange: [8, 16],
        colors: [0x8a8478, 0x6f6a5e, 0x9c9284, 0x77726a],
        parkChance: 0.04,
        ground: 0x555049,
    },
    sunset: {
        name: 'SUNSET DISTRICT',
        style: 'house',
        heightRange: [4, 8],
        colors: [0xe8c9a0, 0xd9b98a, 0xc9d9c0, 0xd0c4e0, 0xe0d0c0],
        parkChance: 0.22,
        ground: 0x4c8c4a,
    },
    airport: {
        name: 'AIRPORT',
        style: 'airport',
        special: true,
        parkChance: 0,
        ground: 0x5c5c5c,
    },
    oldtown: {
        name: 'OLD TOWN',
        style: 'oldtown',
        heightRange: [6, 14],
        colors: [0xb0603c, 0xa8542f, 0xc4744a, 0x9c5a38],
        parkChance: 0.08,
        ground: 0x8a8378,
    },
    downtown: {
        name: 'DOWNTOWN',
        style: 'skyscraper',
        heightRange: [35, 95],
        colors: [0x7fa8c9, 0x9fb8cc, 0x6d8fa8, 0xb0c4d4, 0x8ba0b0],
        parkChance: 0.03,
        ground: 0x606060,
    },
    commercial: {
        name: 'COMMERCIAL DISTRICT',
        style: 'shop',
        heightRange: [10, 24],
        colors: [0xc9c0b0, 0xb8b0a0, 0xd0c8b8, 0xa8a094],
        parkChance: 0.06,
        ground: 0x707070,
    },
    beach: {
        name: 'OCEAN BEACH',
        style: 'beach',
        special: true,
        parkChance: 0,
        ground: 0xe0d2a0,
    },
    hills: {
        name: 'NORTH HILLS',
        style: 'house',
        heightRange: [5, 10],
        colors: [0xe0d4c0, 0xd0c8b0, 0xc8d0c0, 0xd8c0c8],
        parkChance: 0.28,
        ground: 0x5c9450,
    },
};

const LAYOUT = {
    'low,low': 'industrial',
    'mid,low': 'sunset',
    'high,low': 'airport',
    'low,mid': 'oldtown',
    'mid,mid': 'downtown',
    'high,mid': 'commercial',
    'low,high': 'beach',
    'mid,high': 'hills',
    'high,high': 'hills',
};

function bandOf(coord) {
    const third = CONFIG.GRID_COUNT / 3;
    if (coord < third) return 'low';
    if (coord < third * 2) return 'mid';
    return 'high';
}

export function getDistrictKey(gx, gz) {
    return LAYOUT[`${bandOf(gx)},${bandOf(gz)}`];
}

// Βρίσκει τη συνοικία στην οποία βρίσκεται ένα σημείο του κόσμου (π.χ. ο παίκτης)
export function getDistrictAtWorld(x, z) {
    const half = CONFIG.CITY_SIZE / 2;
    let gx = Math.floor((x + half) / CONFIG.CELL_SIZE);
    let gz = Math.floor((z + half) / CONFIG.CELL_SIZE);
    gx = Math.max(0, Math.min(CONFIG.GRID_COUNT - 1, gx));
    gz = Math.max(0, Math.min(CONFIG.GRID_COUNT - 1, gz));
    const key = getDistrictKey(gx, gz);
    return DISTRICTS[key];
}
