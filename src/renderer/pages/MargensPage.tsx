import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  RotateCcw,
  Save,
  CheckCircle2,
  Ruler,
} from 'lucide-react';
import {
  type Margins,
  PDF_MARGINS_KEY,
  DEFAULT_MARGINS,
  MARGINS_MIN,
  MARGINS_MAX,
  MARGINS_STEP,
  MARGINS_A4_MM,
  clampMargin,
} from '@/lib/margens';

const STYLES = {
  top:    { color: 'var(--blue-500, #3b82f6)', label: 'Superior' },
  right:  { color: 'var(--green-500, #22c55e)', label: 'Direita' },
  bottom: { color: 'var(--orange-500, #f97316)', label: 'Inferior' },
  left:   { color: 'var(--purple-500, #a855f7)', label: 'Esquerda' },
} as const;

const iconMap: Record<string, React.ReactNode> = {
  top:    <ArrowUp size={14} />,
  right:  <ArrowRight size={14} />,
  bottom: <ArrowDown size={14} />,
  left:   <ArrowLeft size={14} />,
};

export const MargensPage: React.FC = () => {
  const [margins, setMargins] = useState<Margins>(DEFAULT_MARGINS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.ipcAPI.configuracao.obter(PDF_MARGINS_KEY);
        if (r.success && r.data) {
          const parsed = JSON.parse(r.data) as Margins;
          setMargins({
            top: parsed.top ?? DEFAULT_MARGINS.top,
            right: parsed.right ?? DEFAULT_MARGINS.right,
            bottom: parsed.bottom ?? DEFAULT_MARGINS.bottom,
            left: parsed.left ?? DEFAULT_MARGINS.left,
          });
          setIsCustom(true);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateMargin = useCallback((side: keyof Margins, value: number) => {
    setMargins(prev => ({ ...prev, [side]: clampMargin(value) }));
  }, []);

  const handleSliderChange = useCallback((side: keyof Margins, values: number[]) => {
    updateMargin(side, values[0]);
  }, [updateMargin]);

  const handleInputChange = useCallback((side: keyof Margins, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) updateMargin(side, v);
  }, [updateMargin]);

  const handleRestoreDefault = useCallback(() => {
    setMargins(DEFAULT_MARGINS);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const json = JSON.stringify(margins);
      const r = await window.ipcAPI.configuracao.salvar(PDF_MARGINS_KEY, json, 'json', 'Margens padrão para geração de PDF');
      if (r.success) {
        setIsCustom(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const a4Aspect = MARGINS_A4_MM.width / MARGINS_A4_MM.height;

  if (loading) {
    return (
      <div className="container mx-auto px-2 py-6 space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="lg:col-span-3 h-[400px]" />
          <Skeleton className="lg:col-span-2 h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 py-6 space-y-6 animate-fade-in max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Ruler className="h-6 w-6 text-primary" />
            Margens do PDF
          </h1>
          <p className="text-muted-foreground">
            Configure as margens aplicadas na geração de laudos em PDF
          </p>
        </div>
        <Badge variant={isCustom ? 'default' : 'secondary'} className="self-start">
          {isCustom ? 'Personalizado' : 'Padrão'}
        </Badge>
      </div>

      {saved && (
        <Alert className="bg-primary/10 border-primary/20 text-primary animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Margens salvas com sucesso</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Pré-visualização</CardTitle>
            <CardDescription>Folha A4 com as margens em escala proporcional</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div
              className="relative w-full max-w-[300px] bg-muted/40 rounded-xl border p-2"
            >
              <div
                className="relative mx-auto overflow-hidden rounded border bg-white dark:bg-slate-100 shadow-sm"
                style={{ aspectRatio: a4Aspect.toString() }}
              >
                {/* Top margin */}
                <div
                  className="absolute top-0 left-0 right-0 flex items-end justify-center transition-all duration-200"
                  style={{
                    height: `${(margins.top / MARGINS_MAX) * 100}%`,
                    maxHeight: `${(MARGINS_MAX / MARGINS_A4_MM.height) * 100}%`,
                    background: `linear-gradient(to bottom, var(--blue-500, #3b82f6) 0%, transparent 100%)`,
                    opacity: 0.3,
                  }}
                >
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-0.5 bg-background/80 px-1 rounded">
                    {margins.top} cm
                  </span>
                </div>
                {/* Bottom margin */}
                <div
                  className="absolute bottom-0 left-0 right-0 flex items-start justify-center transition-all duration-200"
                  style={{
                    height: `${(margins.bottom / MARGINS_MAX) * 100}%`,
                    maxHeight: `${(MARGINS_MAX / MARGINS_A4_MM.height) * 100}%`,
                    background: `linear-gradient(to top, var(--orange-500, #f97316) 0%, transparent 100%)`,
                    opacity: 0.3,
                  }}
                >
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 mt-0.5 bg-background/80 px-1 rounded">
                    {margins.bottom} cm
                  </span>
                </div>
                {/* Left margin */}
                <div
                  className="absolute top-0 bottom-0 left-0 flex items-center justify-end transition-all duration-200"
                  style={{
                    width: `${(margins.left / MARGINS_MAX) * 100}%`,
                    maxWidth: `${(MARGINS_MAX / MARGINS_A4_MM.width) * 100}%`,
                    background: `linear-gradient(to right, var(--purple-500, #a855f7) 0%, transparent 100%)`,
                    opacity: 0.3,
                  }}
                >
                  <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 mr-0.5 bg-background/80 px-1 rounded whitespace-nowrap">
                    {margins.left} cm
                  </span>
                </div>
                {/* Right margin */}
                <div
                  className="absolute top-0 bottom-0 right-0 flex items-center justify-start transition-all duration-200"
                  style={{
                    width: `${(margins.right / MARGINS_MAX) * 100}%`,
                    maxWidth: `${(MARGINS_MAX / MARGINS_A4_MM.width) * 100}%`,
                    background: `linear-gradient(to left, var(--green-500, #22c55e) 0%, transparent 100%)`,
                    opacity: 0.3,
                  }}
                >
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 ml-0.5 bg-background/80 px-1 rounded">
                    {margins.right} cm
                  </span>
                </div>
                {/* Content area with dashed border */}
                <div
                  className="absolute border border-dashed border-muted-foreground/30 flex items-center justify-center"
                  style={{
                    top: `${(margins.top / MARGINS_MAX) * 100}%`,
                    bottom: `${(margins.bottom / MARGINS_MAX) * 100}%`,
                    left: `${((margins.left / MARGINS_MAX) * 50)}%`,
                    right: `${((margins.right / MARGINS_MAX) * 50)}%`,
                  }}
                >
                  <span className="text-[9px] text-muted-foreground/50 select-none whitespace-nowrap">
                    conteúdo
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Ajustar Margens</CardTitle>
            <CardDescription>Valores em centímetros (cm)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {(Object.keys(STYLES) as (keyof typeof STYLES)[]).map(side => {
              const style = STYLES[side];
              return (
                <div key={side} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-sm font-medium cursor-default">
                      <span className="text-muted-foreground">{iconMap[side]}</span>
                      {style.label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={MARGINS_MIN}
                        max={MARGINS_MAX}
                        step={MARGINS_STEP}
                        value={margins[side]}
                        onChange={e => handleInputChange(side, e)}
                        className="w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-muted-foreground w-4">cm</span>
                    </div>
                  </div>
                  <Slider
                    value={[margins[side]]}
                    onValueChange={vals => handleSliderChange(side, vals)}
                    min={MARGINS_MIN}
                    max={MARGINS_MAX}
                    step={MARGINS_STEP}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                  />
                   <div className="flex justify-between text-[10px] text-muted-foreground">
                     <span>0 cm</span>
                     <span>{MARGINS_MAX} cm</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          variant="outline"
          onClick={handleRestoreDefault}
          className="flex items-center gap-2"
        >
          <RotateCcw size={15} />
          Restaurar padrão
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          <Save size={15} />
          {saving ? 'Salvando...' : 'Salvar margens'}
        </Button>
      </div>
    </div>
  );
};
