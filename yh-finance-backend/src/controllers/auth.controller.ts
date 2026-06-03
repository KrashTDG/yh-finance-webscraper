import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) { res.status(400).json({ error: "User already exists" }); return; }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully!" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) { res.status(400).json({ error: "Invalid credentials" }); return; }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) { res.status(400).json({ error: "Invalid credentials" }); return; }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
        res.json({ token, email: user.email });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};