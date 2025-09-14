import { Search, Upload, Menu, X, LogIn, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface HeaderProps {
  onUpload: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

const Header = ({ onUpload, searchQuery, onSearchChange, onMenuToggle, isMobileMenuOpen }: HeaderProps) => {
  const { user, signOut } = useAuth();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 shadow-lg sticky top-0 z-[50] backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Mobile menu button and Logo */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-white/20 rounded-xl"
              onClick={onMenuToggle}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white">DigiLocker</h1>
                <p className="text-xs text-blue-100 -mt-1">Smart Document Storage</p>
              </div>
            </div>
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/70 focus:bg-white/20 focus:border-white/40 rounded-xl"
              />
            </div>
          </div>

          {/* Mobile Search Toggle and Upload */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-white/20 rounded-xl"
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            >
              <Search className="w-5 h-5" />
            </Button>
            
            <Button
              onClick={onUpload}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm rounded-xl shadow-lg transition-all duration-200 hover:scale-105"
              size={isSearchExpanded ? "icon" : "default"}
            >
              <Upload className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline font-medium">Upload</span>
            </Button>
            {user ? (
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-xl" onClick={() => {
                if (window.confirm('Are you sure you want to log out?')) {
                  signOut();
                }
              }}>
                <LogOut className="w-5 h-5" />
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-xl">
                  <LogIn className="w-5 h-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        {isSearchExpanded && (
          <div className="md:hidden pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/70 focus:bg-white/20 focus:border-white/40 rounded-xl"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;