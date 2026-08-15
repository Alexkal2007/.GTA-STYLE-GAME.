// js/save.js
// Save/load μέσω localStorage του browser — δουλεύει και μετά το export σε
// δικό σου hosting, δεν χρειάζεται server ή σύνδεση στο AI platform.
// Αποθηκεύει: θέση παίκτη, χρήματα, wanted level, ποια αποστολή είναι ενεργή.

const KEY = 'metrocity_save_v1';

export const SaveSystem = {
    hasSave() {
        try {
            return !!localStorage.getItem(KEY);
        } catch (e) {
            return false;
        }
    },

    save(data) {
        try {
            localStorage.setItem(KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    clear() {
        try {
            localStorage.removeItem(KEY);
        } catch (e) {
            // αγνόησέ το — δεν είναι κρίσιμο
        }
    },
};
