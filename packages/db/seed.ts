import "dotenv/config";
import { connectDB, mongoose, User, Website, WebsiteTick } from "./src";

const USER_ID = "user_seed_admin";

async function seed() {
  await connectDB();

  // Clean slate
  await Promise.all([
    User.deleteMany({}),
    Website.deleteMany({}),
    WebsiteTick.deleteMany({}),
  ]);

  await User.create({
    _id: USER_ID,
    email: "admin@admin.com",
    name: "Admin User",
  });

  const website = await Website.create({
    url: "https://www.google.com",
    name: "Google",
    userId: USER_ID,
    disabled: false,
  });

  await WebsiteTick.create([
    {
      websiteId: website._id,
      status: "UP",
      latency: 40,
      createdAt: new Date(),
    },
    {
      websiteId: website._id,
      status: "UP",
      latency: 100,
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      websiteId: website._id,
      status: "DOWN",
      latency: 100,
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
    },
  ]);

  console.log("Seed complete");
  await mongoose.disconnect();
}

seed();
