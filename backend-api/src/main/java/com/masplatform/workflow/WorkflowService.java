package com.masplatform.workflow;

import com.masplatform.workflow.dto.WorkflowDto;
import com.masplatform.workflow.dto.WorkflowRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository workflowRepo;

    private static final List<String> VALID_TYPES = List.of(
            "sequential", "concurrent", "handoff", "groupchat", "magentic", "declarative"
    );

    public List<WorkflowDto> list(UUID userId) {
        return workflowRepo.findByUserIdOrderByUpdatedAtDesc(userId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public WorkflowDto create(UUID userId, WorkflowRequest req) {
        validate(req);
        Workflow w = Workflow.builder()
                .userId(userId)
                .name(req.getName())
                .description(req.getDescription())
                .orchestrationType(req.getOrchestrationType())
                .graphJson(req.getGraphJson() != null ? req.getGraphJson()
                        : Map.of("nodes", List.of(), "edges", List.of()))
                .yamlContent(req.getYamlContent())
                .isTemplate(req.isTemplate())
                .templateCategory(req.getTemplateCategory())
                .build();
        return toDto(workflowRepo.save(w));
    }

    public WorkflowDto get(UUID id, UUID userId) {
        return workflowRepo.findByIdAndUserId(id, userId)
                .map(this::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @Transactional
    public WorkflowDto update(UUID id, UUID userId, WorkflowRequest req) {
        validate(req);
        Workflow w = workflowRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        w.setName(req.getName());
        w.setDescription(req.getDescription());
        w.setOrchestrationType(req.getOrchestrationType());
        if (req.getGraphJson() != null) w.setGraphJson(req.getGraphJson());
        w.setYamlContent(req.getYamlContent());
        w.setTemplate(req.isTemplate());
        w.setTemplateCategory(req.getTemplateCategory());
        return toDto(workflowRepo.save(w));
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Workflow w = workflowRepo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        workflowRepo.delete(w);
    }

    /** Convert workflow entity to the engine config payload used at runtime. */
    public Map<String, Object> toEngineConfig(Workflow w) {
        return Map.of(
                "id",                 w.getId().toString(),
                "name",               w.getName(),
                "orchestration_type", w.getOrchestrationType(),
                "yaml_content",       w.getYamlContent() != null ? w.getYamlContent() : "",
                "graph_json",         w.getGraphJson() != null ? w.getGraphJson() : Map.of()
        );
    }

    private void validate(WorkflowRequest req) {
        if (!VALID_TYPES.contains(req.getOrchestrationType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid orchestration_type: " + req.getOrchestrationType());
        }
    }

    private WorkflowDto toDto(Workflow w) {
        return WorkflowDto.builder()
                .id(w.getId())
                .name(w.getName())
                .description(w.getDescription())
                .orchestrationType(w.getOrchestrationType())
                .graphJson(w.getGraphJson())
                .yamlContent(w.getYamlContent())
                .isTemplate(w.isTemplate())
                .templateCategory(w.getTemplateCategory())
                .createdAt(w.getCreatedAt())
                .updatedAt(w.getUpdatedAt())
                .build();
    }
}
