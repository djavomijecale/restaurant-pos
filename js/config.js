// ============================================
// FIREBASE CONFIG & GLOBAL STATE
// ============================================

// ============================================
// FIREBASE REST API CONFIGURATION
// ============================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC1bcysO7v34xhqLTJlTNXpK_XtCS372aE",
    databaseURL: "https://restaurant-pos-5ecf4-default-rtdb.europe-west1.firebasedatabase.app",
    authDomain: "restaurant-pos-5ecf4.firebaseapp.com",
    projectId: "restaurant-pos-5ecf4"
};

// ============================================
// FIREBASE INITIALIZATION & AUTHENTICATION
// ============================================
// Inicijalizuj Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const database = firebase.database();

// 🔒 ANONYMOUS AUTHENTICATION - Za sigurnost baze
let isFirebaseAuthReady = false;

console.log('🔄 Autentifikacija u toku...');
auth.signInAnonymously()
    .then(() => {
        console.log('✅ Firebase Auth: Uspešno autentifikovan!');
        console.log('✅ Baza je sada zaštićena - samo tvoja aplikacija može da pristupi!');
        isFirebaseAuthReady = true;
        
        // loadFromFirebase se poziva iz initApp() - ne treba duplikat
    })
    .catch((error) => {
        console.error('❌ Firebase Auth greška:', error.code, error.message);
        console.warn('⚠️ Auth nije aktivan - možda nisi enable-ovao Anonymous Auth u Firebase Console');
        console.warn('⚠️ App će raditi ali baza NIJE zaštićena!');
        
        // FALLBACK: Nastavi bez auth (za testiranje)
        isFirebaseAuthReady = false;
        
        // loadFromFirebase se poziva iz initApp() - ne treba duplikat
    });

// Slušaj promene auth statusa
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ User ID:', user.uid);
        console.log('✅ Anonymous:', user.isAnonymous);
        isFirebaseAuthReady = true;
    } else {
        console.log('❌ Korisnik nije autentifikovan');
        isFirebaseAuthReady = false;
    }
});

// ============================================
// DATABASE OBJECT
// ============================================
const DB = {
    menu: [],
    tables: [],
    orders: [],
    removedItems: [],
    settings: {},
    users: [],
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
    selectedTable: null,
    selectedCat: 'Sve',
    selectedGroup: 'Sve',
    konobarName: localStorage.getItem('konobarName') || null,
    workdays: {},
    workdayHistory: [],
    kitchenOrders: [],
    groceryList: [],
    shoppingList: [],
    deletedGroceryItems: [],  // Blacklist za obrisane stavke
    guestOrders: [],  // QR narudžbine od gostiju
    waiterCalls: [],  // Pozivi konobara od gostiju
    inventory: [],  // Lager - stavke sa stanjem
    invoices: [],  // Istorija faktura
    debts: [],  // Dugovanja
    manuallyEditedCategories: JSON.parse(localStorage.getItem('manuallyEditedCategories') || '{}')  // Lokalno čuvanje ručnih izmena!
};

let isLoading = false;

// ============================================
// SYNC DRINKS TO GROCERY LIST
// ============================================

// Additional global variables
let lastUpdate = null;
let page = 'login', payMethod = '';
let editingTableNum = null;
let confirmCallback = null;
let editingWaiterUsername = null;
let lastKnownPendingCount = 0; // Za praćenje novih kuhinjskih narudžbina
let lastKnownGuestPendingCount = 0; // Za praćenje QR narudžbina
let lastKnownWaiterCallsCount = 0; // Za praćenje poziva konobara
let kitchenTimeInterval = null; // Za auto-update vremena
let selectedWaiterUsername = null;
let editingGroceryItemId = null;
let editingMenuItemId = null;
