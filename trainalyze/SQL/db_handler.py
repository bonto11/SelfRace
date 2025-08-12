from supabase import create_client, Client

SUPABASE_URL = "https://lljkdgkbrgzsrssgejuy.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsamtkZ2ticmd6c3Jzc2dlanV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0OTU3MzgsImV4cCI6MjA3MDA3MTczOH0.AN2nse9c3Gp-yaLJ3T4TH1BkSLqPLSRsrMmQNo7SXkw"
     
def get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
