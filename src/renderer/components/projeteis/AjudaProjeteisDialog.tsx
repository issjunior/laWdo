import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LIMITE_PROXIMIDADE_PERCENTUAL } from '@shared/utils/proximidade-medida';

export function AjudaProjeteisDialog({ limiteProximidade = LIMITE_PROXIMIDADE_PERCENTUAL }: { limiteProximidade?: number }) {
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline"><CircleHelp className="mr-2 h-4 w-4" aria-hidden="true" />Entenda o cálculo</Button></DialogTrigger>
    <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] flex-col overflow-clip sm:max-w-3xl">
      <DialogHeader className="shrink-0 border-b pb-4 pr-6">
        <DialogTitle>Entenda o cálculo</DialogTitle>
        <DialogDescription>Como preencher as medidas, ajustar a comparação e interpretar a classificação.</DialogDescription>
      </DialogHeader>
      <div role="region" aria-label="Conteúdo da ajuda" tabIndex={0} className="min-h-0 space-y-6 overflow-y-auto overscroll-contain pr-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <section className="space-y-3" aria-labelledby="ajuda-como-usar">
          <h3 id="ajuda-como-usar" className="text-base font-semibold">1. Como usar</h3>
          <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
            <li><strong className="text-foreground">Preencha as medidas preservadas.</strong> Calibre real médio, altura máxima e massa são opcionais. Use valores positivos, com vírgula ou ponto decimal. Deixe em branco dimensões comprometidas pela deformação.</li>
            <li><strong className="text-foreground">Escolha uma prioridade.</strong> Use “Priorizar esta medida” junto ao campo correspondente. A massa é a prioridade inicial; as demais medidas preenchidas também influenciam a ordem.</li>
            <li><strong className="text-foreground">Indique perda de material.</strong> Na área da massa, marque “Houve perda de material” quando parte do projétil tiver sido perdida. O ícone ao lado explica como isso afeta a comparação.</li>
            <li><strong className="text-foreground">Ajuste a comparação.</strong> Abaixo das medidas, “Formato/Constituição” restringe os candidatos pelo tipo de projétil. Em “Proximidade”, clique no percentual para ajustar o limite com a barra ou o campo numérico, de 0 a 100%. O padrão é 5%; com 0%, só contam coincidências e valores dentro da faixa.</li>
            <li><strong className="text-foreground">Consulte e recomece.</strong> “Consultar fontes” abre os dois documentos preferenciais. “Ver catálogo completo” reúne as referências e os cadastros personalizados. “Limpar resultados” apaga as medidas e restaura massa como prioridade, todos os formatos e proximidade de 5%, além de desmarcar a perda de material.</li>
          </ol>
          <p className="text-muted-foreground">Os ajustes são mantidos enquanto você permanece nesta página, inclusive ao abrir a ajuda ou consultar fontes.</p>
        </section>
        <section className="space-y-3 border-t pt-5" aria-labelledby="ajuda-cartoes">
          <h3 id="ajuda-cartoes" className="text-base font-semibold">2. Como interpretar os cartões</h3>
          <div className="rounded-md border border-emerald-500/60 bg-emerald-500/10 p-3">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">Verde: até {limiteProximidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% da referência</p>
            <p className="mt-1">“Mesmo valor” ou “Dentro da faixa” indicam desvio zero. “Próxima da referência” indica um desvio maior que zero e de até {limiteProximidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%, incluindo o limite.</p>
          </div>
          <p>O destaque é individual por medida. A diferença exibida tem sinal: <strong>medido − referência</strong>, acompanhada do percentual em relação à referência. Em faixas, esse percentual usa o limite mais próximo; dentro delas, é zero. O indicador <strong>medidas próximas</strong> conta as medidas preenchidas que estão dentro do limite. Medidas ausentes na referência continuam no total esperado e ficam identificadas no próprio bloco.</p>
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="font-medium">Cálculo do destaque visual</p>
            <p className="break-words font-mono text-xs">desvio percentual = |medido − referência| / referência × 100</p>
            <p className="text-muted-foreground">Em faixas, o desvio é zero dentro delas; fora, usa-se o limite mais próximo como referência. Exemplo com o padrão de 5%: uma referência de 10 g fica verde de 9,5 a 10,5 g.</p>
          </div>
          <p className="text-muted-foreground">O percentual de {limiteProximidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% é o <strong>limite de proximidade</strong>. Ajuste o limite no controle “Proximidade”. O mesmo limite define o verde e quais medidas contam como próximas para ordenar os resultados. Esse limite não representa incerteza metrológica validada; essa avaliação depende do processo de medição.</p>
          <p>As medalhas indicam somente <strong>1º, 2º e 3º lugares na lista atual</strong>. A pontuação não é probabilidade de identificação, e a ordem não determina o calibre por si só.</p>
        </section>
        <section className="space-y-3 border-t pt-5" aria-labelledby="ajuda-calculo">
          <h3 id="ajuda-calculo" className="text-base font-semibold">3. Como calculamos a ordem</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Pesos usados na classificação com as três medidas disponíveis</caption>
              <thead className="bg-muted/40"><tr><th scope="col" className="px-3 py-2 font-medium">Medida</th><th scope="col" className="px-3 py-2 text-right font-medium">Peso</th></tr></thead>
              <tbody className="divide-y"><tr><th scope="row" className="px-3 py-2 font-normal">Prioritária</th><td className="px-3 py-2 text-right tabular-nums">60</td></tr><tr><th scope="row" className="px-3 py-2 font-normal">Cada uma das outras duas</th><td className="px-3 py-2 text-right tabular-nums">20</td></tr></tbody>
            </table>
          </div>
          <p>Para ordenar, o desvio absoluto é dividido pelo <strong>valor observado</strong>. O destaque verde usa o <strong>valor da referência</strong>; são cálculos com finalidades diferentes.</p>
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="font-medium">Fórmula da classificação</p>
            <p className="break-words font-mono text-xs">erro relativo = |observado − referência| / observado</p>
            <p className="break-words font-mono text-xs">pontuação = soma(peso × erro relativo) / soma(pesos utilizados)</p>
            <p className="font-medium">Mais medidas próximas aparecem primeiro. Dentro do mesmo grupo, prevalece a presença da prioridade preenchida na referência e depois a menor pontuação.</p>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="font-semibold">Exemplo de cálculo</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1"><dt className="text-muted-foreground">Massa observada</dt><dd className="text-right">10 g</dd><dt className="text-muted-foreground">Massa de referência</dt><dd className="text-right">10,2 g</dd><dt className="text-muted-foreground">Desvio absoluto</dt><dd className="text-right">0,2 g</dd><dt className="text-muted-foreground">Erro relativo</dt><dd className="text-right">0,2 / 10 = 0,02</dd></dl>
            <p>Com massa prioritária e as duas dimensões exatas:</p>
            <p className="break-words rounded bg-muted/40 p-2 font-mono text-xs">(60 × 0,02 + 20 × 0 + 20 × 0) / 100 = 0,012</p>
          </div>
        </section>
        <section className="space-y-3 border-t pt-5" aria-labelledby="ajuda-situacoes">
          <h3 id="ajuda-situacoes" className="text-base font-semibold">4. Situações especiais</h3>
          <dl className="space-y-3">
            <div><dt className="font-semibold">Medidas ausentes</dt><dd className="text-muted-foreground">Campos vazios e medidas ausentes na referência não entram na média. Os pesos disponíveis são redistribuídos proporcionalmente. Dentro de cada grupo com a mesma quantidade de medidas próximas, referências sem a medida prioritária preenchida ficam depois das que possuem esse dado. Uma referência parcial com mais medidas próximas pode superar uma completa com medidas distantes.</dd></div>
            <div><dt className="font-semibold">Prioridade sem valor</dt><dd className="text-muted-foreground">A comparação usa as outras medidas preenchidas. Sem nenhuma medida, a lista é apenas filtrada por formato.</dd></div>
            <div><dt className="font-semibold">Perda de material</dt><dd className="text-muted-foreground">A massa vira um limite inferior: não recebe verde nem participa da proximidade. Primeiro aparecem referências com massa igual ou superior à observada, depois as sem massa e, por último, as de massa inferior. Dentro desses grupos, conta-se a quantidade de dimensões próximas e depois aplica-se a pontuação das dimensões preenchidas. A massa não entra no total de medidas elegíveis para proximidade. Sem dimensões, não há proximidade nem estimativa da perda.</dd></div>
            <div><dt className="font-semibold">Desempates</dt><dd className="text-muted-foreground">Após os grupos de massa, quantidade de medidas próximas, presença da prioridade e pontuação, prevalece a referência com mais medidas comparadas. Depois, a ordem é estabilizada por calibre, tipo e identificador.</dd></div>
          </dl>
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
