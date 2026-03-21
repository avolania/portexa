"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Zap, GitMerge, Check } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useProjectStore } from "@/store/useProjectStore";
import { cn } from "@/lib/utils";
import type { Project, Priority, ProjectType } from "@/types";

const schema = z.object({
  name: z.string().min(2, "Proje adı en az 2 karakter olmalıdır"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  startDate: z.string().min(1, "Başlangıç tarihi gereklidir"),
  endDate: z.string().min(1, "Bitiş tarihi gereklidir"),
  budget: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PROJECT_TYPES: {
  id: ProjectType;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  activeBg: string;
  activeBorder: string;
  features: string[];
}[] = [
  {
    id: "agile",
    icon: Zap,
    title: "Agile",
    subtitle: "Scrum / Kanban",
    color: "text-indigo-600",
    activeBg: "bg-indigo-50",
    activeBorder: "border-indigo-500",
    features: ["Sprint tabanlı planlama", "Kanban board", "Story point takibi", "Backlog yönetimi"],
  },
  {
    id: "waterfall",
    icon: GitMerge,
    title: "Waterfall",
    subtitle: "Şelale Modeli",
    color: "text-cyan-600",
    activeBg: "bg-cyan-50",
    activeBorder: "border-cyan-500",
    features: ["Faz bazlı yönetim", "Sıralı iş akışı", "Gereksinim → Dağıtım", "Milestone takibi"],
  },
];

interface Props {
  onClose: () => void;
}

export default function NewProjectModal({ onClose }: Props) {
  const addProject = useProjectStore((s) => s.addProject);
  const [projectType, setProjectType] = useState<ProjectType>("agile");
  const [step, setStep] = useState<1 | 2>(1);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  const onSubmit = async (data: FormData) => {
    await new Promise((r) => setTimeout(r, 500));
    const project: Project = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      status: "active",
      priority: data.priority as Priority,
      projectType,
      currentSprint: projectType === "agile" ? 1 : undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      progress: 0,
      budget: data.budget ? Number(data.budget) : undefined,
      budgetUsed: 0,
      managerId: "1",
      members: ["1"],
      tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addProject(project);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Yeni Proje Oluştur</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn("w-6 h-1.5 rounded-full transition-colors", step >= 1 ? "bg-indigo-500" : "bg-gray-200")} />
              <div className={cn("w-6 h-1.5 rounded-full transition-colors", step >= 2 ? "bg-indigo-500" : "bg-gray-200")} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Proje tipi seçimi */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Proje Yönetim Metodolojisi</p>
                <p className="text-xs text-gray-500">
                  Seçiminiz görev yönetim arayüzünü ve iş akışını belirler.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PROJECT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isActive = projectType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setProjectType(type.id)}
                      className={cn(
                        "relative text-left p-4 rounded-xl border-2 transition-all duration-150",
                        isActive
                          ? `${type.activeBorder} ${type.activeBg}`
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {isActive && (
                        <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", isActive ? type.activeBg : "bg-gray-100")}>
                        <Icon className={cn("w-5 h-5", isActive ? type.color : "text-gray-500")} />
                      </div>
                      <div className={cn("text-sm font-bold mb-0.5", isActive ? type.color : "text-gray-800")}>
                        {type.title}
                      </div>
                      <div className="text-xs text-gray-500 mb-3">{type.subtitle}</div>
                      <ul className="space-y-1">
                        {type.features.map((f) => (
                          <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isActive ? type.color.replace("text-", "bg-") : "bg-gray-300")} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {/* Methodology info box */}
              <div className={cn(
                "rounded-xl p-4 border text-xs leading-relaxed",
                projectType === "agile"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                  : "bg-cyan-50 border-cyan-200 text-cyan-800"
              )}>
                {projectType === "agile" ? (
                  <>
                    <strong>Agile / Scrum:</strong> Proje sprint&apos;lere (1-4 haftalık döngüler) bölünür.
                    Her sprint sonunda çalışan bir ürün parçası çıkar. Değişen gereksinimlere
                    hızlı adapte olunabilir. Kanban board ile görevler takip edilir.
                  </>
                ) : (
                  <>
                    <strong>Waterfall / Şelale:</strong> Proje sıralı fazlara ayrılır: Gereksinimler
                    → Tasarım → Geliştirme → Test → Dağıtım. Her faz tamamlanmadan
                    bir sonrakine geçilmez. Net zaman çizelgesi ve kapsam gerektiren
                    projelere uygundur.
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  İptal
                </Button>
                <Button type="button" className="flex-1" onClick={() => setStep(2)}>
                  Devam Et →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Proje detayları */}
          {step === 2 && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Seçilen tip badge */}
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border",
                projectType === "agile"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-cyan-50 text-cyan-700 border-cyan-200"
              )}>
                {projectType === "agile" ? <Zap className="w-3.5 h-3.5" /> : <GitMerge className="w-3.5 h-3.5" />}
                {projectType === "agile" ? "Agile — Scrum/Kanban" : "Waterfall — Şelale Modeli"}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="ml-1 opacity-60 hover:opacity-100 underline"
                >
                  değiştir
                </button>
              </div>

              <Input
                id="name"
                label="Proje Adı *"
                placeholder="E-ticaret Platformu"
                error={errors.name?.message}
                {...register("name")}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Proje hakkında kısa bir açıklama..."
                  {...register("description")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="startDate"
                  label="Başlangıç *"
                  type="date"
                  error={errors.startDate?.message}
                  {...register("startDate")}
                />
                <Input
                  id="endDate"
                  label="Bitiş *"
                  type="date"
                  error={errors.endDate?.message}
                  {...register("endDate")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Öncelik</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    {...register("priority")}
                  >
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
                <Input
                  id="budget"
                  label="Bütçe (₺)"
                  type="number"
                  placeholder="100000"
                  {...register("budget")}
                />
              </div>

              <Input
                id="tags"
                label="Etiketler"
                placeholder="web, react, api (virgülle ayırın)"
                {...register("tags")}
              />

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  ← Geri
                </Button>
                <Button type="submit" className="flex-1" loading={isSubmitting}>
                  Proje Oluştur
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
