// store/services/inventory.service.js

const CharacterDAO = require('../dao/character.dao.js');
const CharacterInventoryDAO = require('../dao/character_inventory.dao.js');
const CharacterInventoryFieldDAO = require('../dao/character_inventory_field.dao.js');

const characterDAO = new CharacterDAO();
const inventoryDAO = new CharacterInventoryDAO();
const fieldDAO = new CharacterInventoryFieldDAO();

/**
 * Create an inventory item and optionally assign fields.
 */
async function createItem(characterId, { name, type = null, description = null, equipped = false, fields = {} }) {
    const item = await inventoryDAO.create({
        characterId,
        name,
        type,
        description,
        equipped,
    });

    if (fields && typeof fields === 'object') {
        await fieldDAO.bulkUpsert(item.id, fields);
    }

    return item;
}

/**
 * Get all inventory items for a character, with their fields.
 */
async function getInventory(characterId) {
    const items = await inventoryDAO.findByCharacter(characterId);

    const enriched = await Promise.all(
        items.map(async (item) => {
            const fields = await fieldDAO.findByInventory(item.id);
            return { ...item, fields };
        })
    );

    return enriched;
}

/**
 * Get character metadata along with enriched inventory items.
 */
async function getCharacterWithInventory(characterId) {
    const character = await characterDAO.findById(characterId);
    if (!character) return null;

    const inventory = await getInventory(characterId);
    return { ...character, inventory };
}

/**
 * Update or insert a single field on an item.
 */
async function updateField(inventoryId, name, value, meta = {}) {
    return fieldDAO.create(inventoryId, name, value, meta);
}

/**
 * Bulk update fields on an item.
 */
async function updateFields(inventoryId, fieldMap) {
    return fieldDAO.bulkUpsert(inventoryId, fieldMap);
}

/**
 * Delete an entire item and all its fields.
 */
async function deleteItem(inventoryId) {
    await fieldDAO.deleteByInventory(inventoryId); // precautionary
    await inventoryDAO.deleteById(inventoryId);
}

/**
 * Toggle an item's equipped state.
 */
async function setEquipped(inventoryId, equipped) {
    return inventoryDAO.toggleEquipped(inventoryId, equipped);
}

module.exports = {
    createItem,
    getInventory,
    getCharacterWithInventory,
    updateField,
    updateFields,
    deleteItem,
    setEquipped,
};
