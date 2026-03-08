import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      {theme === "dark" ? "Светла тема" : "Тъмна тема"}
    </Button>
  );
}
