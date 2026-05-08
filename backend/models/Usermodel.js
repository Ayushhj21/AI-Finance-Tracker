import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: 6,
        select: false
    },
    avatar: {
        type: String,
        default: null
    },
    currency: {
        type: String,
        default: "USD",
        enum: ["USD", "EUR", "GBP", "INR", "JPY", "CNY"]
    },
    // Stores ONLY the JTI of the currently-active refresh token, not the token itself.
    // Phase 2 Task 6: refresh token rotation — every refresh issues a new jti; using
    // an old refresh token whose jti no longer matches is treated as replay and
    // invalidates the family (clears this field, forcing a fresh login).
    refreshTokenJti: {
        type: String,
        select: false
    },
    googleId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

//Hash password before saving
//it will come to this middleware only when we create or update password, not for other updates like name or email to encrypt the password before saving it to the database. This ensures that the password is always stored securely, even if the user updates their profile without changing their password.
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
        throw err;
    }
});

//Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};  

const User = mongoose.model("User", userSchema);

export default User;