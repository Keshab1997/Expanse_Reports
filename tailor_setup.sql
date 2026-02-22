-- Supabase SQL Setup for Tailor Expenses
-- Run this in Supabase SQL Editor

-- Create tailor_expenses table
CREATE TABLE tailor_expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    date DATE NOT NULL,
    celebrity_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security
ALTER TABLE tailor_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tailor expenses" 
ON tailor_expenses FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tailor expenses" 
ON tailor_expenses FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tailor expenses" 
ON tailor_expenses FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_tailor_expenses_user_date ON tailor_expenses(user_id, date DESC);
