import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPin(pin) {
    try {
        return await bcrypt.hash(pin, SALT_ROUNDS);
    } catch (error) {
        console.error("❌ Error hashing pin:", error);
        throw error;
    }
}
