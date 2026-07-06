const fs = require('fs');
let code = fs.readFileSync('src/components/OrderTab.tsx', 'utf-8');
const search = `                const catDepts = category?.target_departments || ['kitchen'];

                // REGLA 1: Si la categoría pertenece a UN SOLO departamento (Ej: Bebidas -> Barra)
                if (catDepts.length === 1) {
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: catDepts,
                        is_served: false,
                        notes: ''
                    });
                    return;
                }

                // Evaluar la receta (Smart Splitter para combos)
                const recipe = (productIngredients || []).filter(pi => pi.product_id === pid);
                if (recipe.length === 0) {
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: ['kitchen'],
                        is_served: false,
                        notes: ''
                    });
                    return;
                }

                const deptsMap: Record<string, string[]> = {};
                recipe.forEach(ri => {
                    const ing = ingredients.find(ingr => ingr.id === ri.ingredient_id);
                    const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : ['kitchen'];
                    depts.forEach((d: string) => {
                        if (!deptsMap[d]) deptsMap[d] = [];
                        if (ing) deptsMap[d].push(ing.name);
                    });
                });

                const deptsFound = Object.keys(deptsMap);
                if (deptsFound.length <= 1) {
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: deptsFound.length === 1 ? [deptsFound[0]] : ['kitchen'],
                        is_served: false,
                        notes: ''
                    });
                } else {
                    // Multi-departamento REAL: Dividir de forma inteligente (Hamburguesa + Bebida)
                    deptsFound.forEach((d, idx) => {
                        orderItemsToInsert.push({
                            order_id: order.id,
                            product_id: pid,
                            quantity: qty,
                            unit_price: idx === 0 ? price : 0, // Solo el primero lleva el precio del combo
                            status: 'pending',
                            tenant_id: tenant?.id,
                            target_departments: [d],
                            is_served: false,
                            notes: deptsMap[d].join(' + ') // Nombre específico del componente
                        });
                    });
                }`;

const replace = `                const catDepts = (category?.target_departments && category.target_departments.length > 0) ? category.target_departments : ['kitchen'];

                // Evaluar la receta (Smart Splitter para combos y recetas individuales)
                const recipe = (productIngredients || []).filter(pi => pi.product_id === pid);
                if (recipe.length === 0) {
                    // Si no tiene receta (ingredientes), enviarlo al departamento por defecto de su categoría
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: catDepts,
                        is_served: false,
                        notes: ''
                    });
                    return;
                }

                // Agrupar departamentos presentes en la receta
                const deptsMap: Record<string, string[]> = {};
                recipe.forEach(ri => {
                    const ing = ingredients.find(ingr => ingr.id === ri.ingredient_id);
                    // Si el insumo no tiene depto, asume el de la categoría padre
                    const depts = (ing?.target_departments && ing.target_departments.length > 0) ? ing.target_departments : catDepts;
                    depts.forEach((d: string) => {
                        if (!deptsMap[d]) deptsMap[d] = [];
                        if (ing) deptsMap[d].push(ing.name);
                    });
                });

                const deptsFound = Object.keys(deptsMap);
                if (deptsFound.length <= 1) {
                    // Si todos los insumos van al mismo lugar, no desglosamos visualmente
                    orderItemsToInsert.push({
                        order_id: order.id,
                        product_id: pid,
                        quantity: qty,
                        unit_price: price,
                        status: 'pending',
                        tenant_id: tenant?.id,
                        target_departments: deptsFound.length === 1 ? [deptsFound[0]] : catDepts,
                        is_served: false,
                        notes: ''
                    });
                } else {
                    // Multi-departamento REAL: Dividir de forma inteligente (Hamburguesa + Bebida)
                    deptsFound.forEach((d, idx) => {
                        orderItemsToInsert.push({
                            order_id: order.id,
                            product_id: pid,
                            quantity: qty,
                            unit_price: idx === 0 ? price : 0, // Solo el primero lleva el precio del combo
                            status: 'pending',
                            tenant_id: tenant?.id,
                            target_departments: [d],
                            is_served: false,
                            notes: deptsMap[d].join(' + ') // Nombre específico del componente
                        });
                    });
                }`;

if (code.includes(search)) {
    fs.writeFileSync('src/components/OrderTab.tsx', code.replace(search, replace));
    console.log('Success');
} else {
    console.error('Not found');
}
