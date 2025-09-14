import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Login = () => {
    const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email);
      toast({
        title: "Check your email",
        description: "Magic link sent. Click it to log in.",
      });
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  useEffect(()=>{
    if(user){
      navigate('/');
    }
  },[user]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-50 via-sky-50 to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-5xl grid md:grid-cols-2 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-lg bg-white/50 ring-1 ring-black/5">
        {/* Illustration */}
        <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-indigo-600 to-sky-500 p-10">
          <div className="text-white text-center">
            <div className="w-28 h-28 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-extrabold">DL</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight">Welcome&nbsp;Back</h2>
            <p className="mt-2 text-white/80 max-w-xs mx-auto">
              Access your digital documents securely from any device.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="backdrop-blur-sm bg-white/70 p-8 sm:p-12">
          <div className="flex items-center space-x-2 mb-8 md:hidden">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">DL</span>
            </div>
            <h1 className="text-2xl font-bold text-indigo-700">DigiLocker</h1>
          </div>

          <h2 className="text-2xl font-semibold text-gray-800 mb-6 hidden md:block">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Work or personal email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-white/90 backdrop-blur-sm"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </form>

          <p className="text-xs text-gray-500 mt-6">
            By continuing, you agree to our <a className="underline" href="#">Terms of Service</a> and <a className="underline" href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
