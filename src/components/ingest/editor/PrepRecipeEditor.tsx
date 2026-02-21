import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MetadataFields } from './MetadataFields';

import { IngredientsEditor } from './IngredientsEditor';
import { ProcedureEditor } from './ProcedureEditor';
import { ImagesEditor } from './ImagesEditor';
import { useIngestDraft } from '@/contexts/IngestDraftContext';
import type { TrainingNotes } from '@/types/products';

export function PrepRecipeEditor() {
  const { state, dispatch } = useIngestDraft();
  const { draft } = state;

  // Extract training notes safely
  const tn: TrainingNotes = 'notes' in draft.trainingNotes
    ? draft.trainingNotes as TrainingNotes
    : { notes: '', common_mistakes: [], quality_checks: [] };

  // Extract batch notes safely
  const batchNotes = 'notes' in draft.batchScaling
    ? (draft.batchScaling as { notes: string }).notes
    : '';

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['info', 'ingredients', 'procedure', 'images', 'batch', 'training']}>
        {/* Recipe Info */}
        <AccordionItem value="info">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Recipe Info</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <MetadataFields
                draft={draft}
                onNameChange={(name) => dispatch({ type: 'SET_NAME', payload: name })}
                onPrepTypeChange={(type) => dispatch({ type: 'SET_PREP_TYPE', payload: type })}
                onYieldChange={(qty, unit) => dispatch({ type: 'SET_YIELD', payload: { qty, unit } })}
                onShelfLifeChange={(value, unit) => dispatch({ type: 'SET_SHELF_LIFE', payload: { value, unit } })}
              />

            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Ingredients */}
        <AccordionItem value="ingredients">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Ingredients
            {draft.ingredients.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({draft.ingredients.reduce((s, g) => s + g.items.length, 0)} items)
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <IngredientsEditor
                groups={draft.ingredients}
                onAddGroup={(name) => dispatch({ type: 'ADD_INGREDIENT_GROUP', payload: name })}
                onRemoveGroup={(i) => dispatch({ type: 'REMOVE_INGREDIENT_GROUP', payload: i })}
                onRenameGroup={(i, name) => dispatch({ type: 'RENAME_INGREDIENT_GROUP', payload: { index: i, name } })}
                onMoveGroupUp={(i) => dispatch({ type: 'MOVE_GROUP_UP', payload: i })}
                onMoveGroupDown={(i) => dispatch({ type: 'MOVE_GROUP_DOWN', payload: i })}
                onAddIngredient={(gi) => dispatch({ type: 'ADD_INGREDIENT', payload: { groupIndex: gi } })}
                onUpdateIngredient={(gi, ii, item) => dispatch({ type: 'UPDATE_INGREDIENT', payload: { groupIndex: gi, itemIndex: ii, item } })}
                onRemoveIngredient={(gi, ii) => dispatch({ type: 'REMOVE_INGREDIENT', payload: { groupIndex: gi, itemIndex: ii } })}
                onMoveIngredientUp={(gi, ii) => dispatch({ type: 'MOVE_INGREDIENT_UP', payload: { groupIndex: gi, itemIndex: ii } })}
                onMoveIngredientDown={(gi, ii) => dispatch({ type: 'MOVE_INGREDIENT_DOWN', payload: { groupIndex: gi, itemIndex: ii } })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Procedure */}
        <AccordionItem value="procedure">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Procedure
            {draft.procedure.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({draft.procedure.reduce((s, g) => s + g.steps.length, 0)} steps)
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <ProcedureEditor
                groups={draft.procedure}
                onAddGroup={(name) => dispatch({ type: 'ADD_PROCEDURE_GROUP', payload: name })}
                onRemoveGroup={(i) => dispatch({ type: 'REMOVE_PROCEDURE_GROUP', payload: i })}
                onRenameGroup={(i, name) => dispatch({ type: 'RENAME_PROCEDURE_GROUP', payload: { index: i, name } })}
                onMoveGroupUp={(i) => dispatch({ type: 'MOVE_PROCEDURE_GROUP_UP', payload: i })}
                onMoveGroupDown={(i) => dispatch({ type: 'MOVE_PROCEDURE_GROUP_DOWN', payload: i })}
                onAddStep={(gi) => dispatch({ type: 'ADD_STEP', payload: { groupIndex: gi } })}
                onUpdateStep={(gi, si, step) => dispatch({ type: 'UPDATE_STEP', payload: { groupIndex: gi, stepIndex: si, step } })}
                onRemoveStep={(gi, si) => dispatch({ type: 'REMOVE_STEP', payload: { groupIndex: gi, stepIndex: si } })}
                onMoveStepUp={(gi, si) => dispatch({ type: 'MOVE_STEP_UP', payload: { groupIndex: gi, stepIndex: si } })}
                onMoveStepDown={(gi, si) => dispatch({ type: 'MOVE_STEP_DOWN', payload: { groupIndex: gi, stepIndex: si } })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Images */}
        <AccordionItem value="images">
          <AccordionTrigger className="text-base font-semibold tracking-tight">
            Images
            {draft.images.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({draft.images.length} photo{draft.images.length !== 1 ? 's' : ''})
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <ImagesEditor />
          </AccordionContent>
        </AccordionItem>

        {/* Batch Scaling */}
        <AccordionItem value="batch">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Batch Scaling</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pt-2">
              <Label htmlFor="batch-notes">Batch Notes</Label>
              <Textarea
                id="batch-notes"
                value={batchNotes}
                onChange={(e) => dispatch({ type: 'SET_BATCH_NOTES', payload: e.target.value })}
                placeholder="e.g. Scales linearly. For large batches, use food processor."
                rows={3}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Training Notes */}
        <AccordionItem value="training">
          <AccordionTrigger className="text-base font-semibold tracking-tight">Training Notes</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="training-notes">Notes</Label>
                <Textarea
                  id="training-notes"
                  value={tn.notes}
                  onChange={(e) => dispatch({ type: 'SET_TRAINING_NOTES', payload: e.target.value })}
                  placeholder="General training notes..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="common-mistakes">Common Mistakes (one per line)</Label>
                <Textarea
                  id="common-mistakes"
                  value={tn.common_mistakes.join('\n')}
                  onChange={(e) => dispatch({
                    type: 'SET_COMMON_MISTAKES',
                    payload: e.target.value.split('\n').filter(Boolean),
                  })}
                  placeholder="Over-processing herbs into a paste&#10;Using dried herbs instead of fresh"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quality-checks">Quality Checks (one per line)</Label>
                <Textarea
                  id="quality-checks"
                  value={tn.quality_checks.join('\n')}
                  onChange={(e) => dispatch({
                    type: 'SET_QUALITY_CHECKS',
                    payload: e.target.value.split('\n').filter(Boolean),
                  })}
                  placeholder="Bright green color&#10;Visible herb pieces"
                  rows={3}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

    </div>
  );
}
