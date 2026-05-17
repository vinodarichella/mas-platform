package com.masplatform.workflow.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class WorkflowDto {
    private UUID               id;
    private String             name;
    private String             description;
    private String             orchestrationType;
    private Map<String, Object> graphJson;
    private String             yamlContent;
    private boolean            isTemplate;
    private String             templateCategory;
    private Instant            createdAt;
    private Instant            updatedAt;
}
