// ============================================
// GROCERY SYNC FUNCTIONS
// ============================================


// ============================================
// SYNC DRINKS TO GROCERY LIST
// ============================================
function syncDrinksToGrocery() {
    console.log('🍺 Sinhronizacija pića iz menija u groceryList...');
    
    // DEBUG: Prikaži blacklist
    console.log('🚫 Blacklist trenutno:', DB.deletedGroceryItems);
    console.log('🚫 Blacklist je array?', Array.isArray(DB.deletedGroceryItems));
    console.log('🚫 Blacklist dužina:', DB.deletedGroceryItems ? DB.deletedGroceryItems.length : 'undefined');
    
    // Pronađi sva pića u meniju
    const drinks = DB.menu.filter(item => item.cat === 'Piće');
    console.log(`   Pronađeno ${drinks.length} pića u meniju`);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    drinks.forEach(drink => {
        // Proveri da li je namerno obrisano (blacklist)
        const isBlacklisted = DB.deletedGroceryItems && DB.deletedGroceryItems.some(deleted => 
            deleted.toLowerCase() === drink.name.toLowerCase()
        );
        
        if (isBlacklisted) {
            console.log(`   ⏭️ Preskočeno (obrisano od admina): ${drink.name}`);
            skippedCount++;
            return; // Skip ovu stavku
        }
        
        // Proveri da li već postoji u groceryList
        const exists = DB.groceryList.find(g => 
            g.name.toLowerCase() === drink.name.toLowerCase()
        );
        
        if (!exists) {
            // Dodaj novo piće u groceryList
            const newGroceryItem = {
                id: Date.now() + Math.random(), // Unique ID
                name: drink.name,
                type: 'Piće',
                category: determineDrinkCategory(drink.name, drink.desc),
                needed: false
            };
            
            DB.groceryList.push(newGroceryItem);
            addedCount++;
            console.log(`   ✅ Dodato: ${drink.name} → ${newGroceryItem.category}`);
        }
    });
    
    if (skippedCount > 0) {
        console.log(`⏭️ Preskočeno ${skippedCount} pića (blacklist)`);
    }
    
    if (addedCount > 0) {
        console.log(`✅ Dodato ${addedCount} novih pića u groceryList`);
        // Nemoj snimati odmah, to će se desiti posle
    } else {
        console.log('ℹ️ Sva pića već postoje u groceryList');
    }
}


// Determiniši kategoriju pića na osnovu naziva
function determineDrinkCategory(name, desc) {
    const nameLower = name.toLowerCase();
    const descLower = (desc || '').toLowerCase();
    const combined = nameLower + ' ' + descLower;
    
    // Pivo
    if (combined.match(/pivo|beer|lav|jelen|zaječar|tuborg|heineken|budweiser|staropramen/i)) {
        return 'Pivo';
    }
    
    // Vino
    if (combined.match(/vino|wine|belo vino|crno vino|rose|crveno|bijelo/i)) {
        return 'Vino';
    }
    
    // Alkohol (jaka pića)
    if (combined.match(/rakija|vodka|viski|whisky|rum|džin|gin|konjak|cognac|liker|šampanjac|champagne|tequila|absint/i)) {
        return 'Alkohol';
    }
    
    // Sokovi i gazirana pića
    if (combined.match(/coca|cola|koka|fanta|sprite|pepsi|schweppes|limunada|cedevita|gazir/i)) {
        return 'Sokovi';
    }
    
    // Svježi sokovi
    if (combined.match(/svježi|fresh|prirodn.*sok|ceđen.*sok|narandža|jabuka.*sok|pomorandža/i)) {
        return 'Svježi Sokovi';
    }
    
    // Ledeni čaj
    if (combined.match(/led.*čaj|ice.*tea|fuzetea|nestea/i)) {
        return 'Ledeni Čaj';
    }
    
    // Voda
    if (combined.match(/voda|water|knjaz|rosa|aqua viva|mg mivela|mineralna/i)) {
        return 'Voda';
    }
    
    // Topli napici
    if (combined.match(/kafa|coffee|espresso|cappuccino|čaj|tea|topla čokolada|hot chocolate/i)) {
        return 'Topli Napici';
    }
    
    // Mlečni napici
    if (combined.match(/mleko|milk|jogurt|ayran|boza|shake|smoothie|mlečni/i)) {
        return 'Mlečni Napici';
    }
    
    // Default - Sokovi
    return 'Sokovi';
}


// ============================================
// SYNC PIZZA INGREDIENTS TO GROCERY LIST
// ============================================
function syncPizzaIngredientsToGrocery() {
    console.log('🍕 Sinhronizacija SVOJA PIZZA sastojaka u groceryList...');
    
    // DEBUG: Prikaži blacklist
    console.log('🚫 Blacklist trenutno:', DB.deletedGroceryItems);
    
    // Pronađi sve stavke iz grupe "SVOJA PIZZA"
    const pizzaIngredients = DB.menu.filter(item => 
        item.group && item.group.toUpperCase() === 'SVOJA PIZZA'
    );
    console.log(`   Pronađeno ${pizzaIngredients.length} sastojaka u SVOJA PIZZA grupi`);
    
    if (pizzaIngredients.length === 0) {
        console.log('ℹ️ Nema stavki u SVOJA PIZZA grupi');
        return;
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    pizzaIngredients.forEach(ingredient => {
        // Proveri da li je namerno obrisano (blacklist)
        const isBlacklisted = DB.deletedGroceryItems && DB.deletedGroceryItems.some(deleted => 
            deleted.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        if (isBlacklisted) {
            console.log(`   ⏭️ Preskočeno (obrisano od admina): ${ingredient.name}`);
            skippedCount++;
            return; // Skip ovu stavku
        }
        
        // Proveri da li već postoji u groceryList
        const exists = DB.groceryList.find(g => 
            g.name.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        if (!exists) {
            // Dodaj novi sastojak u groceryList
            const newGroceryItem = {
                id: Date.now() + Math.random(), // Unique ID
                name: ingredient.name,
                type: 'Hrana',
                category: determinePizzaIngredientCategory(ingredient.name, ingredient.desc),
                needed: false
            };
            
            DB.groceryList.push(newGroceryItem);
            addedCount++;
            console.log(`   ✅ Dodato: ${ingredient.name} → ${newGroceryItem.category}`);
        }
    });
    
    if (skippedCount > 0) {
        console.log(`⏭️ Preskočeno ${skippedCount} sastojaka (blacklist)`);
    }
    
    if (addedCount > 0) {
        console.log(`✅ Dodato ${addedCount} novih pizza sastojaka u groceryList`);
    } else {
        console.log('ℹ️ Svi pizza sastojci već postoje u groceryList');
    }
}


// Determiniši kategoriju pizza sastojka na osnovu naziva
function determinePizzaIngredientCategory(name, desc) {
    const nameLower = name.toLowerCase();
    const descLower = (desc || '').toLowerCase();
    const combined = nameLower + ' ' + descLower;
    
    // Povrće
    if (combined.match(/paradajz|krastavac|paprika|luk|pečurke|masline|kukuruz|tikvice|patlidžan|spanać|rukola|cherry|rajčica/i)) {
        return 'Povrće';
    }
    
    // Meso
    if (combined.match(/šunka|slanina|pršuta|kobasica|kulen|piletina|bacon|salama|mortadela|panceta/i)) {
        return 'Meso';
    }
    
    // Mlečno (sirevi)
    if (combined.match(/sir|mocarela|mozzarella|parmezan|gorgonzola|gauda|feta|kačkavalj|pavlaka|kajmak/i)) {
        return 'Mlečno';
    }
    
    // Suvo (brašno, začini, pelati)
    if (combined.match(/brašno|kvasac|pelati|origano|bosiljak|peršun|čili|biber|začin|ulje|so|šećer/i)) {
        return 'Suvo';
    }
    
    // Default - Povrće
    return 'Povrće';
}


// ============================================
// APPLY MANUAL CATEGORY EDITS
// ============================================
function applyManualCategoryEdits() {
    console.log('✏️ Primenjujem ručno izmenjene kategorije...');
    console.log('📝 Ručne izmene:', DB.manuallyEditedCategories);
    
    let appliedCount = 0;
    
    // Za svaku stavku u groceryList
    DB.groceryList.forEach(item => {
        const itemKey = item.name.toLowerCase();
        
        // Ako postoji ručna izmena za ovu stavku
        if (DB.manuallyEditedCategories[itemKey]) {
            const manualCategory = DB.manuallyEditedCategories[itemKey];
            
            // Ako se kategorija razlikuje od one u Firebase
            if (item.category !== manualCategory) {
                console.log(`   ✏️ Primenjujem ručnu izmenu: ${item.name}`);
                console.log(`      Firebase: ${item.category} → Ručno: ${manualCategory}`);
                
                item.category = manualCategory;
                appliedCount++;
            }
        }
    });
    
    if (appliedCount > 0) {
        console.log(`✅ Primenjeno ${appliedCount} ručnih izmena kategorija`);
    } else {
        console.log('ℹ️ Nema ručnih izmena za primenu');
    }
}


function syncDrinksFromMenu() {
    console.log('🔄 Sinhronizacija pića iz menija...');
    
    // 1. Izvuci sva pića iz menija
    const drinksInMenu = DB.menu.filter(item => item.cat === 'Piće');
    console.log('📋 Pronađeno pića u meniju:', drinksInMenu.length);
    
    if(drinksInMenu.length === 0) {
        showAlert('⚠️ Nema pića u meniju!');
        return;
    }
    
    // 2. Funkcija za automatsko određivanje kategorije
    function determineCategory(drinkName, drinkDesc) {
        const name = drinkName.toLowerCase();
        const desc = (drinkDesc || '').toLowerCase();
        const combined = name + ' ' + desc;
        
        // Kafa
        if(combined.includes('kafa') || combined.includes('espresso') || 
           combined.includes('cappuccino') || combined.includes('nescafe') || 
           combined.includes('macchiato')) {
            return 'Topli Napici';
        }
        
        // Čaj
        if(combined.includes('čaj') || combined.includes('tea')) {
            return 'Topli Napici';
        }
        
        // Pivo
        if(combined.includes('pivo') || combined.includes('beer') || 
           combined.includes('heineken') || combined.includes('jelen') || 
           combined.includes('lav') || combined.includes('tuborg') ||
           combined.includes('zaječarsko') || combined.includes('stella')) {
            return 'Pivo';
        }
        
        // Vino
        if(combined.includes('vino') || combined.includes('wine') || 
           combined.includes('bijelo') || combined.includes('crveno') || 
           combined.includes('roze') || combined.includes('bermet')) {
            return 'Vino';
        }
        
        // Voda
        if(combined.includes('voda') || combined.includes('water') || 
           combined.includes('knjaz') || combined.includes('rosa') || 
           combined.includes('aqua') || combined.includes('kisela') ||
           combined.includes('mineralna')) {
            return 'Voda';
        }
        
        // Ledeni čaj
        if(combined.includes('ledeni') || combined.includes('ice tea') || 
           combined.includes('ice-tea') || combined.includes('iced tea')) {
            return 'Ledeni Čaj';
        }
        
        // Svježi sokovi
        if(combined.includes('ceđeni') || combined.includes('fresh') || 
           combined.includes('limunada') || combined.includes('narandža') ||
           combined.includes('grejp') || combined.includes('limun')) {
            return 'Svježi Sokovi';
        }
        
        // Mlečni napici
        if(combined.includes('ayran') || combined.includes('jogurt') || 
           combined.includes('mleko') || combined.includes('milk')) {
            return 'Mlečni Napici';
        }
        
        // Gazirana pića / Sokovi (default)
        return 'Sokovi';
    }
    
    // 3. Dodaj pića koja ne postoje u groceryList
    let addedCount = 0;
    let skippedCount = 0;
    let blacklistedCount = 0;
    
    drinksInMenu.forEach(drink => {
        // PRVO: Proveri da li je namerno obrisano (blacklist)
        const isBlacklisted = DB.deletedGroceryItems && DB.deletedGroceryItems.some(deleted => 
            deleted.toLowerCase() === drink.name.toLowerCase()
        );
        
        if (isBlacklisted) {
            console.log('🚫 Preskočeno (u blacklist-u):', drink.name);
            blacklistedCount++;
            return; // Skip!
        }
        
        // Proveri da li već postoji (case-insensitive)
        const exists = DB.groceryList.find(item => 
            item.name.toLowerCase() === drink.name.toLowerCase()
        );
        
        if(exists) {
            console.log('⏭️ Preskočeno (već postoji):', drink.name);
            skippedCount++;
            return;
        }
        
        // Dodaj novo piće
        const category = determineCategory(drink.name, drink.desc);
        const newItem = {
            id: Date.now() + addedCount, // Unique ID
            name: drink.name,
            type: 'Piće',
            category: category,
            needed: false
        };
        
        DB.groceryList.push(newItem);
        console.log('✅ Dodato:', drink.name, '→', category);
        addedCount++;
    });
    
    // 4. Sačuvaj i prikaži rezultat
    if(addedCount > 0) {
        save();
        render();
        let message = `✅ Uvezeno ${addedCount} pića iz menija!\n⏭️ Preskočeno: ${skippedCount} (već postoje)`;
        if(blacklistedCount > 0) {
            message += `\n🚫 Preskočeno: ${blacklistedCount} (obrisano od admina)`;
        }
        showAlert(message);
    } else {
        let message = `ℹ️ Sva pića iz menija već postoje u nabavci!\n📋 Ukupno pića u meniju: ${drinksInMenu.length}`;
        if(blacklistedCount > 0) {
            message += `\n🚫 Preskočeno: ${blacklistedCount} (obrisano od admina)`;
        }
        showAlert(message);
    }
    
    console.log('📊 Rezultat:');
    console.log('   Dodato:', addedCount);
    console.log('   Preskočeno:', skippedCount);
    console.log('   🚫 Blacklist:', blacklistedCount);
    console.log('   Ukupno u meniju:', drinksInMenu.length);
}


function syncPizzaIngredientsFromMenu() {
    console.log('🔄 Sinhronizacija SVOJA PIZZA sastojaka iz menija...');
    
    // 1. Izvuci sve stavke iz grupe "SVOJA PIZZA"
    const pizzaIngredients = DB.menu.filter(item => 
        item.group && item.group.toUpperCase() === 'SVOJA PIZZA'
    );
    console.log('📋 Pronađeno sastojaka u SVOJA PIZZA grupi:', pizzaIngredients.length);
    
    if(pizzaIngredients.length === 0) {
        showAlert('⚠️ Nema stavki u SVOJA PIZZA grupi!');
        return;
    }
    
    // 2. Dodaj sastojke koji ne postoje u groceryList
    let addedCount = 0;
    let skippedCount = 0;
    let blacklistedCount = 0;
    
    pizzaIngredients.forEach(ingredient => {
        // PRVO: Proveri da li je namerno obrisano (blacklist)
        const isBlacklisted = DB.deletedGroceryItems && DB.deletedGroceryItems.some(deleted => 
            deleted.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        if (isBlacklisted) {
            console.log('🚫 Preskočeno (u blacklist-u):', ingredient.name);
            blacklistedCount++;
            return; // Skip!
        }
        
        // Proveri da li već postoji (case-insensitive)
        const exists = DB.groceryList.find(item => 
            item.name.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        if(exists) {
            console.log('⏭️ Preskočeno (već postoji):', ingredient.name);
            skippedCount++;
            return;
        }
        
        // Dodaj novi sastojak
        const category = determinePizzaIngredientCategory(ingredient.name, ingredient.desc);
        const newItem = {
            id: Date.now() + addedCount, // Unique ID
            name: ingredient.name,
            type: 'Hrana',
            category: category,
            needed: false
        };
        
        DB.groceryList.push(newItem);
        console.log('✅ Dodato:', ingredient.name, '→', category);
        addedCount++;
    });
    
    // 3. Sačuvaj i prikaži rezultat
    if(addedCount > 0) {
        save();
        render();
        let message = `✅ Uvezeno ${addedCount} pizza sastojaka iz menija!\n⏭️ Preskočeno: ${skippedCount} (već postoje)`;
        if(blacklistedCount > 0) {
            message += `\n🚫 Preskočeno: ${blacklistedCount} (obrisano od admina)`;
        }
        showAlert(message);
    } else {
        let message = `ℹ️ Svi pizza sastojci iz menija već postoje u nabavci!\n📋 Ukupno sastojaka u SVOJA PIZZA: ${pizzaIngredients.length}`;
        if(blacklistedCount > 0) {
            message += `\n🚫 Preskočeno: ${blacklistedCount} (obrisano od admina)`;
        }
        showAlert(message);
    }
    
    console.log('📊 Rezultat:');
    console.log('   Dodato:', addedCount);
    console.log('   Preskočeno:', skippedCount);
    console.log('   🚫 Blacklist:', blacklistedCount);
    console.log('   Ukupno u SVOJA PIZZA:', pizzaIngredients.length);
}

