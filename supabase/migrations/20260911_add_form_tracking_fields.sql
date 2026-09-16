-- Add physical form tracking and group leadership fields to registrations table
ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS form_number TEXT,
ADD COLUMN IF NOT EXISTS teaching_group BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS group_form_number TEXT,
ADD COLUMN IF NOT EXISTS meeting_time TEXT;

-- Create index on form_number and group_form_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_registrations_form_number ON public.registrations(form_number);
CREATE INDEX IF NOT EXISTS idx_registrations_group_form_number ON public.registrations(group_form_number);
