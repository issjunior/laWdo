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
  top:    { color: '#4f6ef7', colorSolid: '#4f6ef7', stripClass: 'bg-indigo-500',  textClass: 'text-indigo-600 dark:text-indigo-400',  ringClass: 'focus-visible:ring-indigo-500',  label: 'Superior'  },
  right:  { color: '#0d9488', colorSolid: '#0d9488', stripClass: 'bg-teal-600',    textClass: 'text-teal-700  dark:text-teal-400',    ringClass: 'focus-visible:ring-teal-500',    label: 'Direita'   },
  bottom: { color: '#d97706', colorSolid: '#d97706', stripClass: 'bg-amber-500',   textClass: 'text-amber-600 dark:text-amber-400',   ringClass: 'focus-visible:ring-amber-500',   label: 'Inferior'  },
  left:   { color: '#7c3aed', colorSolid: '#7c3aed', stripClass: 'bg-violet-600',  textClass: 'text-violet-600 dark:text-violet-400', ringClass: 'focus-visible:ring-violet-500',  label: 'Esquerda'  },
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

  const a4Aspect = MARGINS_A4_MM.width / MARGINS_A4_MM.height;
  const pageCm = { w: MARGINS_A4_MM.width / 10, h: MARGINS_A4_MM.height / 10 };

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
    <div className="container mx-auto px-2 py-6 space-y-6 animate-fade-in">
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
            <div className="relative w-full">
              <div
                className="relative mx-auto overflow-hidden rounded border bg-white dark:bg-slate-100 shadow-sm max-h-[75vh]"
                style={{ aspectRatio: a4Aspect.toString() }}
              >
                {/* Top margin */}
                <div
                  className="absolute top-0 left-0 right-0 flex flex-col items-center justify-end transition-all duration-300"
                  style={{
                    height: `${(margins.top / pageCm.h) * 100}%`,
                    maxHeight: `${(MARGINS_MAX / pageCm.h) * 100}%`,
                    background: `linear-gradient(to bottom, ${STYLES.top.color}33 0%, transparent 100%)`,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px] transition-all duration-300"
                    style={{ backgroundColor: STYLES.top.color }}
                  />
                  <span className={`text-[10px] font-bold mb-0.5 px-1.5 py-0.5 rounded-sm ${STYLES.top.textClass}`}
                    style={{ backgroundColor: `${STYLES.top.color}18` }}>
                    {margins.top} cm
                  </span>
                </div>
                {/* Bottom margin */}
                <div
                  className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-start transition-all duration-300"
                  style={{
                    height: `${(margins.bottom / pageCm.h) * 100}%`,
                    maxHeight: `${(MARGINS_MAX / pageCm.h) * 100}%`,
                    background: `linear-gradient(to top, ${STYLES.bottom.color}33 0%, transparent 100%)`,
                  }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] transition-all duration-300"
                    style={{ backgroundColor: STYLES.bottom.color }}
                  />
                  <span className={`text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-sm ${STYLES.bottom.textClass}`}
                    style={{ backgroundColor: `${STYLES.bottom.color}18` }}>
                    {margins.bottom} cm
                  </span>
                </div>
                {/* Left margin */}
                <div
                  className="absolute top-0 bottom-0 left-0 flex items-center justify-end transition-all duration-300"
                  style={{
                    width: `${(margins.left / pageCm.w) * 100}%`,
                    maxWidth: `${(MARGINS_MAX / pageCm.w) * 100}%`,
                    background: `linear-gradient(to right, ${STYLES.left.color}33 0%, transparent 100%)`,
                  }}
                >
                  <div
                    className="absolute top-0 bottom-0 left-0 w-[3px] transition-all duration-300"
                    style={{ backgroundColor: STYLES.left.color }}
                  />
                  <span className={`text-[10px] font-bold mr-0.5 px-1.5 py-0.5 rounded-sm whitespace-nowrap ${STYLES.left.textClass}`}
                    style={{ backgroundColor: `${STYLES.left.color}18` }}>
                    {margins.left} cm
                  </span>
                </div>
                {/* Right margin */}
                <div
                  className="absolute top-0 bottom-0 right-0 flex items-center justify-start transition-all duration-300"
                  style={{
                    width: `${(margins.right / pageCm.w) * 100}%`,
                    maxWidth: `${(MARGINS_MAX / pageCm.w) * 100}%`,
                    background: `linear-gradient(to left, ${STYLES.right.color}33 0%, transparent 100%)`,
                  }}
                >
                  <div
                    className="absolute top-0 bottom-0 right-0 w-[3px] transition-all duration-300"
                    style={{ backgroundColor: STYLES.right.color }}
                  />
                  <span className={`text-[10px] font-bold ml-0.5 px-1.5 py-0.5 rounded-sm ${STYLES.right.textClass}`}
                    style={{ backgroundColor: `${STYLES.right.color}18` }}>
                    {margins.right} cm
                  </span>
                </div>
                {/* Content area with dashed border */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    top: `${(margins.top / pageCm.h) * 100}%`,
                    bottom: `${(margins.bottom / pageCm.h) * 100}%`,
                    left: `${(margins.left / pageCm.w) * 100}%`,
                    right: `${(margins.right / pageCm.w) * 100}%`,
                    outline: '2px dashed rgba(100,116,139,0.55)',
                    outlineOffset: '-1px',
                  }}
                >
                  <span className="text-[11px] font-bold select-none whitespace-nowrap tracking-[0.18em] uppercase text-muted-foreground/80">
                    Conteúdo
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
                    <Label className="flex items-center gap-2 text-sm font-semibold cursor-default">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded"
                        style={{ color: style.color, backgroundColor: `${style.color}18` }}
                      >
                        {iconMap[side]}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: style.color }}
                      />
                      {style.label}
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={MARGINS_MIN}
                        max={MARGINS_MAX}
                        step={MARGINS_STEP}
                        value={margins[side]}
                        onChange={e => handleInputChange(side, e)}
                        className={`w-16 h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold ${style.ringClass}`}
                        style={{ borderColor: `${style.color}55`, color: style.color }}
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
                    style={{ '--slider-color': style.color } as React.CSSProperties}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/70">
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
