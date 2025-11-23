import { supabase } from "../client";

export const getPipelines = (empresa_id) =>
  supabase.from("pipeline").select("*, etapas(*)").eq("empresa_id", empresa_id);

export const createPipeline = (payload) =>
  supabase.from("pipeline").insert(payload).select().single();

export const updatePipeline = (id, payload) =>
  supabase.from("pipeline").update(payload).eq("id", id).select().single();

export const deletePipeline = (id) =>
  supabase.from("pipeline").delete().eq("id", id);

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
  const stagesToInsert = stages.map(stage => ({
    nombre: stage.name,
    pipeline_id: pipelineId,
    orden: stage.order,
    color: stage.color,
  }));

  // 3. Insertar las etapas
  const { data: insertedStages, error: stagesError } = await supabase
    .from('etapas')
    .insert(stagesToInsert)
    .select();

  if (stagesError) {
    console.error('Error creating stages:', stagesError);
    console.warn('Stages creation failed, but pipeline was created.');
  }

  // 4. Devolver el pipeline completo
  const { data: newPipelineWithStages } = await supabase
    .from('pipeline')
    .select(`*`)
    .eq('id', pipelineId)
    .single();

  // Mapear etapas insertadas
  const mappedStages = (insertedStages || []).map(s => ({
    id: s.id,
    name: s.nombre,
    order: s.orden,
    color: s.color,
    pipelineType: newPipelineWithStages.nombre.toLowerCase().trim().replace(/\s+/g, '-')
  }));

  return { 
    ...newPipelineWithStages, 
    name: newPipelineWithStages.nombre, 
    stages: mappedStages 
  };
};
