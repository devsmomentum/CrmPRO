import { supabase } from "@/lib/supabase";

export const createPipelineWithStages = async (pipelineData) => {
  const { name, stages, empresa_id } = pipelineData;

  // 1. Insertar el pipeline
  const { data: pipeline, error: pipelineError } = await supabase
    .from('pipeline')
    .insert({ nombre: name, empresa_id })
    .select('id')
    .single();

  if (pipelineError) {
    console.error('Error creating pipeline:', pipelineError);
    throw new Error(`Error creating pipeline: ${pipelineError.message}`);
  }

  if (!pipeline) {
    throw new Error('Failed to create pipeline, no ID returned.');
  }

  const pipelineId = pipeline.id;

  // 2. Preparar las etapas para la inserción
  // TODO: Verificar la estructura de la tabla 'etapas' antes de insertar
  /*
  const stagesToInsert = stages.map(stage => ({
    nombre: stage.name,
    pipeline_id: pipelineId,
    orden: stage.order,
    color: stage.color,
  }));

  // 3. Insertar las etapas
  const { error: stagesError } = await supabase
    .from('etapas')
    .insert(stagesToInsert);

  if (stagesError) {
    console.error('Error creating stages:', stagesError);
    // Opcional: si falla la creación de etapas, se podría eliminar el pipeline recién creado.
    // await supabase.from('pipeline').delete().match({ id: pipelineId });
    // throw new Error(stagesError.message);
    console.warn('Stages creation failed, but pipeline was created.');
  }
  */

  // 4. Devolver el pipeline completo (por ahora sin etapas)
  const { data: newPipelineWithStages } = await supabase
    .from('pipeline')
    .select(`*`)
    .eq('id', pipelineId)
    .single();

  return { ...newPipelineWithStages, stages: [] };
};
