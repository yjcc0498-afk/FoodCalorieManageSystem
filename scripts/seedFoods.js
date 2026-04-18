// This file generates sample food records and inserts them into MongoDB.
require('dotenv').config();

const connectDB = require('../config/db');
const Food = require('../models/Food');

const foodTemplates = [
  { name: 'Grilled Chicken Breast', minCalories: 140, maxCalories: 190 },
  { name: 'Boiled Egg', minCalories: 68, maxCalories: 90 },
  { name: 'Brown Rice Bowl', minCalories: 180, maxCalories: 260 },
  { name: 'Avocado Toast', minCalories: 220, maxCalories: 320 },
  { name: 'Greek Yogurt', minCalories: 95, maxCalories: 150 },
  { name: 'Banana Oatmeal', minCalories: 160, maxCalories: 240 },
  { name: 'Salmon Salad', minCalories: 250, maxCalories: 360 },
  { name: 'Beef Sandwich', minCalories: 280, maxCalories: 420 },
  { name: 'Vegetable Soup', minCalories: 70, maxCalories: 140 },
  { name: 'Sweet Potato', minCalories: 100, maxCalories: 180 },
  { name: 'Tofu Stir Fry', minCalories: 200, maxCalories: 310 },
  { name: 'Apple Slices', minCalories: 45, maxCalories: 85 }
];

const getRandomCalories = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const buildRandomFoods = (count = 8) => {
  const shuffledTemplates = [...foodTemplates].sort(() => Math.random() - 0.5);

  return shuffledTemplates.slice(0, count).map((item) => ({
    name: item.name,
    calories: getRandomCalories(item.minCalories, item.maxCalories)
  }));
};

const seedFoods = async () => {
  try {
    await connectDB();

    // Seed data stays separate from controller flow so request handling remains cleanly layered.
    const foodsToInsert = buildRandomFoods();
    const insertedFoods = await Food.insertMany(foodsToInsert);

    console.log(`Inserted ${insertedFoods.length} foods into MongoDB.`);
    insertedFoods.forEach((food, index) => {
      console.log(`${index + 1}. ${food.name} - ${food.calories} kcal - ${food._id}`);
    });
  } catch (error) {
    console.error('Failed to seed foods:', error.message);
    process.exitCode = 1;
  } finally {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
  }
};

seedFoods();
