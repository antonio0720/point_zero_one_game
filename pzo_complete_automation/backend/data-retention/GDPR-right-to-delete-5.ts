await someModel.deleteMany({ userId });

// Mark the user as deleted in the database (optional step depending on your data model)
user.isDeleted = true;
await user.save();
}

// Schedule a job to run periodically using a cron job or another task scheduler
// For example, with Node-cron:
// const cron = require("node-cron");
// cron.schedule("0 0 * * *", async () => {
//   const usersToDelete = await User.find({ isDeleted: true }).exec();
//   for (const user of usersToDelete) {
//     deleteDataByUserId(user._id);
//   }
// });
```

This code assumes you have a `User` model with an `isDeleted` field to track deleted users. In your specific use case, you should replace the commented line with the appropriate data deletion logic based on your application's data structure and requirements. The function also provides a cron job example that runs every day at midnight to delete users marked as deleted.
