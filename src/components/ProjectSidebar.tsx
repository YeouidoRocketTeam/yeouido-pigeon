import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus, Folder, Trash2, X, Check, MoreHorizontal, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface ProjectSidebarProps {
  selectedProjectId: string | null; // null means "all"
  onSelectProject: (projectId: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

const PROJECT_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

const PROJECT_ICONS = ["📁", "💼", "📊", "🏦", "🔬", "🌍", "⚡", "🎯", "📈", "💡"];

const ProjectSidebar = ({ selectedProjectId, onSelectProject, isOpen, onClose }: ProjectSidebarProps) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(PROJECT_ICONS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchProjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setProjects(data as Project[]);
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const createProject = async () => {
    if (!newName.trim() || !user) return;
    await supabase.from("projects").insert({
      user_id: user.id,
      name: newName.trim(),
      color: selectedColor,
      icon: selectedIcon,
    });
    setNewName("");
    setIsCreating(false);
    setSelectedColor(PROJECT_COLORS[0]);
    setSelectedIcon(PROJECT_ICONS[0]);
    fetchProjects();
  };

  const deleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    if (selectedProjectId === id) onSelectProject(null);
    fetchProjects();
  };

  const renameProject = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from("projects").update({ name: editName.trim() }).eq("id", id);
    setEditingId(null);
    fetchProjects();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-card border-r flex flex-col shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b">
              <h2 className="text-sm font-semibold text-foreground">프로젝트</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
              {/* All insights */}
              <button
                onClick={() => { onSelectProject(null); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedProjectId === null
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Inbox className="h-4 w-4" />
                <span>전체 인사이트</span>
              </button>

              {projects.map((project) => (
                <div key={project.id} className="group relative">
                  {editingId === project.id ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameProject(project.id)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <button onClick={() => renameProject(project.id)} className="p-1 text-primary">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { onSelectProject(project.id); onClose(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        selectedProjectId === project.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="text-base">{project.icon}</span>
                      <span className="truncate flex-1 text-left">{project.name}</span>
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <span className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={() => { setEditingId(project.id); setEditName(project.name); }}>
                            이름 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteProject(project.id)} className="text-destructive">
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Create new */}
            <div className="border-t p-3">
              {isCreating ? (
                <div className="space-y-3">
                  <Input
                    placeholder="프로젝트 이름"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createProject()}
                    className="h-9 text-sm"
                    autoFocus
                  />
                  {/* Icon picker */}
                  <div className="flex flex-wrap gap-1">
                    {PROJECT_ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setSelectedIcon(icon)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-base transition-colors ${
                          selectedIcon === icon ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  {/* Color picker */}
                  <div className="flex gap-1.5">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          selectedColor === color ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createProject} className="flex-1 h-8 text-xs">
                      만들기
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} className="h-8 text-xs">
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                >
                  <FolderPlus className="h-4 w-4" />
                  새 프로젝트
                </Button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProjectSidebar;
