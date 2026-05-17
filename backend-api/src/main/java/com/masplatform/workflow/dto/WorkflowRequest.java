package com.masplatform.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class WorkflowRequest {
    @NotBlank
    private String name;

    private String description;

    @NotBlank
    private String orchestrationType;

    private Map<String, Object> graphJson;

    private String yamlContent;

    private boolean isTemplate;
    private String  templateCategory;
}
