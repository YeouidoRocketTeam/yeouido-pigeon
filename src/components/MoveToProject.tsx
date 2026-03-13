import { useState, useEffect } from "react";
import { FolderInput, Check, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface MoveToProjectProps {
  insightId: string;
  currentProjectId: string | null;
  onMoved?: () => void;
}

const MoveToProject = ({ insightId, currentProjectId, onMoved }: MoveToProjectProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id, name, icon, color")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
      });
  }, [user]);

  const moveTo = async (projectId: string | null) => {
    if (projectId === currentProjectId) return;
    const { error } = await supabase
      .from("insights")
      .update({ project_id: projectId })
      .eq("id", insightId);

    if (error) {
      toast({ title: "이동 실패", description: error.message, variant: "destructive" });
    } else {
      const target = projectId
        ? projects.find((p) => p.id === projectId)?.name ?? "프로젝트"
        : "전체 인사이트";
      toast({ title: `"${target}"(으)로 이동했습니다` });
      onMoved?.();
    }
  };

  if (projects.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <FolderInput className="h-4 w-4" />
          <span className="text-xs">이동</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => moveTo(null)}
          className="gap-2"
        >
          <Inbox className="h-4 w-4" />
          <span>전체 인사이트</span>
          {currentProjectId === null && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => moveTo(project.id)}
            className="gap-2"
          >
            <span className="text-sm">{project.icon}</span>
            <span className="truncate">{project.name}</span>
            {currentProjectId === project.id && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MoveToProject;
