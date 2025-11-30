import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

async function addVolumeColumn() {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'DailyPrices';
    const columnName = 'volume';

    try {
        console.log(`Checking if column '${columnName}' exists in table '${tableName}'...`);
        const tableDesc = await queryInterface.describeTable(tableName);

        if (tableDesc[columnName]) {
            console.log(`Column '${columnName}' already exists. Skipping.`);
            return;
        }

        console.log(`Adding column '${columnName}' to table '${tableName}'...`);
        await queryInterface.addColumn(tableName, columnName, {
            type: DataTypes.BIGINT,
            allowNull: true,
            defaultValue: null,
            comment: 'Volumen de negociación'
        });

        console.log(`Column '${columnName}' added successfully.`);
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        await sequelize.close();
    }
}

addVolumeColumn();
